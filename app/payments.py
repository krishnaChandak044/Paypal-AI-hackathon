import os
from decimal import Decimal
from typing import Any, Dict, Optional

import httpx
from fastapi import HTTPException
from sqlalchemy.orm import Session

from .models import Ledger, Payment

PAYPAL_BASE_URL = "https://api-m.sandbox.paypal.com"


def amount_string(minor: int) -> str:
    """Formats minor currency units into a standard decimal string (e.g. 100 -> '1.00')."""
    return f"{Decimal(minor) / 100:.2f}"


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

    if payment.status == "confirmed":
        if payment.capture_id == capture_id:
            return False  # Already applied
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
