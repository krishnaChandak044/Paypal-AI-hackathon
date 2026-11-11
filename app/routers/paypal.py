import os
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import actor, campaign, log, require
from ..database import engine, get_db, now, uid
from ..models import (
    AidRequest,
    Campaign,
    Member,
    Ledger,
    Payment,
    Subscription,
    WebhookEvent,
)
from ..payments import (
    amount_string,
    apply_capture,
    paypal_request,
)
from ..schemas import JourneyStep, OrderIn, PayPalImpactJourneyOut

router = APIRouter(tags=["PayPal Payments & Webhooks"])


def paypal_checkout_context() -> Dict[str, str]:
    """Builds a local/deployed return path for the non-JavaScript PayPal flow."""
    app_url = os.getenv("RELIEFRAIL_APP_URL", "http://127.0.0.1:3000").rstrip("/")
    parsed = urlparse(app_url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise HTTPException(status_code=500, detail="RELIEFRAIL_APP_URL must be an absolute HTTP(S) URL")
    if parsed.scheme != "https" and parsed.hostname not in {"localhost", "127.0.0.1", "::1"}:
        raise HTTPException(status_code=500, detail="RELIEFRAIL_APP_URL must use HTTPS outside local development")
    return {
        "return_url": f"{app_url}/?paypal=return",
        "cancel_url": f"{app_url}/?paypal=cancel",
        "user_action": "PAY_NOW",
        "shipping_preference": "NO_SHIPPING",
    }


@router.post("/campaigns/{campaign_id}/paypal/orders")
async def create_paypal_order(
    campaign_id: str,
    body: OrderIn,
    session: Session = Depends(get_db),
    current_member: Member = Depends(actor),
):
    """Creates a PayPal sandbox checkout order for a donor contribution."""
    c = campaign(session, campaign_id, current_member)
    if c.currency not in ("USD", "EUR", "GBP", "AUD", "CAD"):
        raise HTTPException(status_code=400, detail="Unsupported prototype currency")

    request_id = uid()
    payload = {
        "intent": "CAPTURE",
        "payment_source": {
            "paypal": {
                "experience_context": paypal_checkout_context(),
            }
        },
        "purchase_units": [
            {
                "reference_id": campaign_id,
                "custom_id": campaign_id,
                "amount": {
                    "currency_code": c.currency,
                    "value": amount_string(body.amount_minor),
                },
            }
        ],
    }

    async with httpx.AsyncClient(timeout=20) as client:
        data = await paypal_request(client, "POST", "/v2/checkout/orders", payload, request_id)

    order_id = data.get("id")
    if not order_id:
        raise HTTPException(status_code=502, detail="PayPal order missing ID")

    payment = Payment(
        campaign_id=campaign_id,
        order_id=order_id,
        amount_minor=body.amount_minor,
        currency=c.currency,
    )
    session.add(payment)
    session.flush()

    log(session, current_member, "payment.order_created", payment.id)
    session.commit()

    return {
        "order_id": order_id,
        "status": "pending",
        "links": [
            {"rel": x.get("rel"), "href": x.get("href")}
            for x in data.get("links", [])
            if x.get("rel") in ("approve", "payer-action")
        ],
    }


@router.post("/paypal/orders/{order_id}/capture")
async def capture_paypal_order(
    order_id: str,
    session: Session = Depends(get_db),
    current_member: Member = Depends(actor),
):
    """Executes capture on an approved PayPal order and transactionally updates the ledger."""
    payment = session.scalar(select(Payment).where(Payment.order_id == order_id))
    if not payment:
        raise HTTPException(status_code=404, detail="Order not found")

    campaign(session, payment.campaign_id, current_member)

    if payment.status == "confirmed":
        return {"status": "confirmed", "capture_id": payment.capture_id}

    async with httpx.AsyncClient(timeout=20) as client:
        data = await paypal_request(
            client,
            "POST",
            f"/v2/checkout/orders/{order_id}/capture",
            body={},
            request_id=payment.id,
        )

    captures = [
        cap
        for unit in data.get("purchase_units", [])
        for cap in unit.get("payments", {}).get("captures", [])
    ]
    if len(captures) != 1:
        raise HTTPException(status_code=502, detail="Expected exactly one capture in response")

    session.rollback()
    if engine.dialect.name == "sqlite":
        session.connection().exec_driver_sql("BEGIN IMMEDIATE")

    payment = session.scalar(select(Payment).where(Payment.order_id == order_id))
    apply_capture(session, payment, captures[0])
    session.commit()

    return {"status": "confirmed", "capture_id": payment.capture_id}


@router.post("/paypal/webhooks")
async def paypal_webhook_handler(
    request: Request,
    session: Session = Depends(get_db),
):
    """Receives and cryptographically verifies asynchronous webhook events from PayPal."""
    webhook_id = os.getenv("PAYPAL_WEBHOOK_ID")
    if not webhook_id:
        raise HTTPException(status_code=503, detail="Webhook ID missing from configuration")

    headers = request.headers
    required_headers = (
        "paypal-auth-algo",
        "paypal-cert-url",
        "paypal-transmission-id",
        "paypal-transmission-sig",
        "paypal-transmission-time",
    )
    if any(not headers.get(h) for h in required_headers):
        raise HTTPException(status_code=400, detail="Missing required PayPal signature headers")

    event_body = await request.json()
    verification_payload = {
        "auth_algo": headers["paypal-auth-algo"],
        "cert_url": headers["paypal-cert-url"],
        "transmission_id": headers["paypal-transmission-id"],
        "transmission_sig": headers["paypal-transmission-sig"],
        "transmission_time": headers["paypal-transmission-time"],
        "webhook_id": webhook_id,
        "webhook_event": event_body,
    }

    async with httpx.AsyncClient(timeout=20) as client:
        result = await paypal_request(
            client,
            "POST",
            "/v1/notifications/verify-webhook-signature",
            verification_payload,
        )

    if result.get("verification_status") != "SUCCESS":
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    event_id = event_body.get("id")
    event_type = event_body.get("event_type")
    if not event_id or not event_type:
        raise HTTPException(status_code=400, detail="Invalid webhook event payload")

    if session.get(WebhookEvent, event_id):
        return {"status": "duplicate"}

    if engine.dialect.name == "sqlite":
        session.rollback()
        session.connection().exec_driver_sql("BEGIN IMMEDIATE")
        if session.get(WebhookEvent, event_id):
            return {"status": "duplicate"}

    if event_type == "PAYMENT.CAPTURE.COMPLETED":
        capture = event_body.get("resource") or {}
        order_id = (
            (capture.get("supplementary_data") or {})
            .get("related_ids", {})
            .get("order_id")
        )
        payment = (
            session.scalar(select(Payment).where(Payment.order_id == order_id))
            if order_id
            else None
        )
        if payment:
            apply_capture(session, payment, capture)

    elif event_type == "PAYMENT.CAPTURE.REFUNDED":
        refund = event_body.get("resource") or {}
        capture_id = (
            (refund.get("supplementary_data") or {})
            .get("related_ids", {})
            .get("capture_id")
        )
        payment = (
            session.scalar(select(Payment).where(Payment.capture_id == capture_id))
            if capture_id
            else None
        )
        if payment and payment.status == "confirmed":
            money = refund.get("amount") or {}
            if (
                money.get("currency_code") == payment.currency
                and money.get("value") == amount_string(payment.amount_minor)
            ):
                payment.status = "refunded"
                session.add(
                    Ledger(
                        campaign_id=payment.campaign_id,
                        kind="refund",
                        amount_minor=payment.amount_minor,
                        reference=f"paypal:refund:{event_id}",
                    )
                )

    elif event_type in {
        "BILLING.SUBSCRIPTION.ACTIVATED",
        "BILLING.SUBSCRIPTION.CANCELLED",
        "BILLING.SUBSCRIPTION.SUSPENDED",
        "BILLING.SUBSCRIPTION.EXPIRED",
    }:
        resource = event_body.get("resource") or {}
        subscription = session.scalar(
            select(Subscription).where(Subscription.subscription_id == resource.get("id"))
        )
        if subscription:
            subscription.status = {
                "BILLING.SUBSCRIPTION.ACTIVATED": "ACTIVE",
                "BILLING.SUBSCRIPTION.CANCELLED": "CANCELLED",
                "BILLING.SUBSCRIPTION.SUSPENDED": "SUSPENDED",
                "BILLING.SUBSCRIPTION.EXPIRED": "EXPIRED",
            }[event_type]

    elif event_type in {"PAYMENT.SALE.COMPLETED", "PAYMENT.SALE.REFUNDED", "PAYMENT.SALE.REVERSED"}:
        sale = event_body.get("resource") or {}
        billing_id = sale.get("billing_agreement_id")
        subscription = session.scalar(
            select(Subscription).where(Subscription.subscription_id == billing_id)
        ) if billing_id else None
        sale_id = sale.get("id")
        amount = sale.get("amount") or {}
        currency = amount.get("currency") or amount.get("currency_code")
        value = amount.get("value") or amount.get("total")
        if subscription and sale_id:
            expected = amount_string(subscription.amount_minor)
            if currency != subscription.currency or value != expected:
                raise HTTPException(status_code=409, detail="Subscription sale amount or currency mismatch")
            if event_type == "PAYMENT.SALE.COMPLETED":
                if subscription.status not in ("ACTIVE", "APPROVAL_PENDING", "LEGACY_UNVERIFIED"):
                    raise HTTPException(status_code=409, detail="Sale received for an inactive subscription")
                subscription.status = "ACTIVE"
                subscription.last_payment_at = sale.get("update_time") or sale.get("create_time") or now()
                reference = f"paypal:subscription-sale:{sale_id}"
                if not session.scalar(select(Ledger.id).where(Ledger.reference == reference)):
                    session.add(Ledger(
                        campaign_id=subscription.campaign_id,
                        kind="contribution",
                        amount_minor=subscription.amount_minor,
                        reference=reference,
                    ))
            else:
                reference = f"paypal:subscription-refund:{sale_id}"
                if not session.scalar(select(Ledger.id).where(Ledger.reference == reference)):
                    session.add(Ledger(
                        campaign_id=subscription.campaign_id,
                        kind="refund",
                        amount_minor=subscription.amount_minor,
                        reference=reference,
                    ))

    session.add(WebhookEvent(id=event_id, event_type=event_type))
    session.commit()

    return {"status": "processed"}


@router.get("/campaigns/{campaign_id}/payments")
def list_campaign_payments(
    campaign_id: str,
    session: Session = Depends(get_db),
    current_member: Member = Depends(actor),
):
    """Lists contribution payment orders and their settlement statuses (Admin / Finance)."""
    require(current_member, ("admin", "finance"))
    campaign(session, campaign_id, current_member)

    payments = session.scalars(
        select(Payment).where(Payment.campaign_id == campaign_id)
    ).all()

    return [
        {
            "order_id": p.order_id,
            "status": p.status,
            "amount_minor": p.amount_minor,
            "currency": p.currency,
            "capture_id": p.capture_id,
        }
        for p in payments
    ]


@router.get("/paypal/orders/{order_id}/journey", response_model=PayPalImpactJourneyOut)
async def get_paypal_order_journey(
    order_id: str,
    session: Session = Depends(get_db),
):
    """Return only facts tied to this exact order; pooled contributions are not earmarked."""
    clean_id = order_id.strip()
    if not clean_id or len(clean_id) > 128:
        raise HTTPException(status_code=404, detail="Payment not found")
    payment = session.scalar(
        select(Payment).where((Payment.order_id == clean_id) | (Payment.capture_id == clean_id))
    )
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    c = session.get(Campaign, payment.campaign_id)
    if not c:
        raise HTTPException(status_code=404, detail="Payment not found")
    capture_entry = session.scalar(
        select(Ledger).where(Ledger.reference == f"paypal:capture:{payment.capture_id}")
    ) if payment.capture_id else None
    status = payment.status
    if status not in {"pending", "confirmed", "refunded", "failed"}:
        status = "pending"
    contribution_step = JourneyStep(
        stage=1,
        title="PayPal contribution",
        subtitle="Campaign emergency pool",
        description=(
            f"${payment.amount_minor / 100:.2f} {payment.currency} was confirmed into the shared campaign pool. "
            "This contribution is not individually earmarked to a specific request."
            if status == "confirmed" else
            f"This ${payment.amount_minor / 100:.2f} {payment.currency} order is {status}; it has not been confirmed as available pool funds."
        ),
        status="completed" if status == "confirmed" else status,
        timestamp=capture_entry.created_at if capture_entry else None,
        reference=f"PAYPAL-ORDER-{payment.order_id[:18]}",
        badge="Pool credited" if status == "confirmed" else status.replace("_", " ").title(),
    )
    allocation_step = JourneyStep(
        stage=2,
        title="Pool allocation",
        subtitle="Campaign-level accounting",
        description="No need-level allocation is linked to this individual contribution. Check the campaign board for current pooled allocations.",
        status="not_recorded",
        reference="",
        badge="Not attributed",
    )
    payout_step = JourneyStep(
        stage=3,
        title="Payout",
        subtitle="Campaign-level fulfillment",
        description="No payout is linked to this contribution. ReliefRail does not claim that this order funded a specific recipient or transfer.",
        status="not_recorded",
        reference="",
        badge="Not attributed",
    )
    receipt_step = JourneyStep(
        stage=4,
        title="Receipt audit",
        subtitle="Campaign-level reconciliation",
        description="No receipt is linked to this contribution in the ledger.",
        status="not_recorded",
        reference="",
        badge="Not attributed",
    )
    return PayPalImpactJourneyOut(
        order_id=clean_id,
        capture_id=payment.capture_id,
        amount_minor=payment.amount_minor,
        currency=payment.currency,
        campaign_name=c.name,
        status=status,
        confirmed_at=capture_entry.created_at if capture_entry else None,
        timeline=[contribution_step, allocation_step, payout_step, receipt_step],
        verified_items_funded=[],
        ai_impact_narrative={
            "supporter_letter": f"Your ${payment.amount_minor / 100:.2f} {payment.currency} contribution is {status} for the {c.name} pooled fund. Individual contributions are not assigned to specific recipients.",
            "social_card": "",
            "audit_summary": "Only the PayPal order and matching pool credit are reported here. Need, payout, and receipt events are shown only if they are actually linked; these records are not currently linked to individual contributions.",
        },
        privacy_note="This page exposes only the exact order's amount, status, and pool credit. It does not expose recipient names, emails, request narratives, or exact locations.",
    )


