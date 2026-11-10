import os
from typing import Dict, List

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import actor, campaign, log, require
from ..database import engine, get_db, uid
from ..models import Ledger, Member, Payment, WebhookEvent
from ..payments import (
    amount_string,
    apply_capture,
    paypal_request,
)
from ..schemas import OrderIn

router = APIRouter(tags=["PayPal Payments & Webhooks"])


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

