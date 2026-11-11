import os
from decimal import Decimal
from typing import Any, Dict, Optional

import httpx
from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .models import Ledger, Payment, ProviderRefund

PAYPAL_BASE_URL = "https://api-m.sandbox.paypal.com"


def amount_string(minor: int) -> str:
    """Formats minor currency units into a standard decimal string (e.g. 100 -> '1.00')."""
    return f"{Decimal(minor) / 100:.2f}"


def amount_minor_from_provider(value: Any) -> int:
    """Parse a provider amount without float rounding; reject sub-cent/negative values."""
    try:
        amount = Decimal(str(value))
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid provider amount") from exc
    minor = amount * 100
    if not amount.is_finite() or minor != minor.to_integral_value() or minor <= 0:
        raise HTTPException(status_code=400, detail="Invalid provider amount")
    return int(minor)


async def get_access_token(client: httpx.AsyncClient) -> str:
    """Retrieves an OAuth2 client credentials token from the PayPal Sandbox API."""
    client_id = os.getenv("PAYPAL_CLIENT_ID")
    client_secret = os.getenv("PAYPAL_CLIENT_SECRET")
    environment = os.getenv("PAYPAL_ENVIRONMENT", "sandbox")

    if environment != "sandbox" or not client_id or not client_secret:
        raise HTTPException(status_code=503, detail="PayPal sandbox is not configured")

    response = await client.post(
        f"{PAYPAL_BASE_URL}/v1/oauth2/token",
        auth=(client_id, client_secret),
        data={"grant_type": "client_credentials"},
    )
    if response.status_code != 200:
        raise HTTPException(status_code=502, detail="PayPal authorization failed")

    return response.json()["access_token"]


async def paypal_request(
    client: httpx.AsyncClient,
    method: str,
    path: str,
    body: Optional[Any] = None,
    request_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Sends an authenticated request to the PayPal Sandbox API with idempotency header support."""
    token = await get_access_token(client)
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    if request_id:
        headers["PayPal-Request-Id"] = request_id

    response = await client.request(
        method,
        f"{PAYPAL_BASE_URL}{path}",
        headers=headers,
        json=body,
    )
    if not response.is_success:
        raise HTTPException(status_code=502, detail="PayPal request failed")
    return response.json()


# Backwards compatibility alias for app/worker.py and others
paypal = paypal_request


def apply_capture(session: Session, payment: Payment, capture: Dict[str, Any]) -> bool:
    """Validates and records a successful capture against a pending Payment and credits the ledger."""
    amount_data = capture.get("amount") or {}
    status = capture.get("status")
    currency = amount_data.get("currency_code")
    value = amount_data.get("value")
    expected_value = amount_string(payment.amount_minor)

    if status != "COMPLETED" or currency != payment.currency or value != expected_value:
        raise HTTPException(status_code=409, detail="Capture status or amount mismatch")

    capture_id = capture.get("id")
    if not capture_id:
        raise HTTPException(status_code=502, detail="Capture ID missing")

    if payment.capture_id == capture_id:
        return False  # Already applied, including after a later partial/full refund
    if payment.status in {"confirmed", "partially_refunded", "refunded"}:
        raise HTTPException(status_code=409, detail="Conflicting capture")

    if payment.capture_id and payment.capture_id != capture_id:
        raise HTTPException(status_code=409, detail="Conflicting capture")

    payment.status = "confirmed"
    payment.capture_id = capture_id

    session.add(
        Ledger(
            campaign_id=payment.campaign_id,
            kind="contribution",
            amount_minor=payment.amount_minor,
            reference=f"paypal:capture:{capture_id}",
        )
    )
    return True


def apply_provider_refund(
    session: Session,
    payment: Payment,
    amount_minor: int,
    event_id: str,
    event_type: str,
) -> bool:
    """Apply a verified refund/reversal once while enforcing capture-level cumulative bounds."""
    if session.get(ProviderRefund, event_id):
        return False
    if payment.status not in {"confirmed", "partially_refunded", "refunded"}:
        raise HTTPException(status_code=409, detail="Refund references an unconfirmed capture")
    already_refunded = session.scalar(
        select(func.coalesce(func.sum(ProviderRefund.amount_minor), 0)).where(
            ProviderRefund.transaction_id == payment.capture_id
        )
    ) or 0
    if amount_minor <= 0 or already_refunded + amount_minor > payment.amount_minor:
        raise HTTPException(status_code=409, detail="Refund amount exceeds the unrefunded capture balance")

    session.add(ProviderRefund(
        event_id=event_id,
        transaction_id=payment.capture_id,
        campaign_id=payment.campaign_id,
        amount_minor=amount_minor,
        currency=payment.currency,
        event_type=event_type,
    ))
    session.add(Ledger(
        campaign_id=payment.campaign_id,
        kind="refund",
        amount_minor=amount_minor,
        reference=f"paypal:{event_type.lower().replace('.', ':')}:{event_id}",
    ))
    payment.refunded_minor = already_refunded + amount_minor
    payment.status = "refunded" if payment.refunded_minor == payment.amount_minor else "partially_refunded"
    return True
