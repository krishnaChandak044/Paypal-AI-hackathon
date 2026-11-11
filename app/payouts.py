"""PayPal sandbox payout calls and explicit provider-status mapping."""
import os
from typing import Any, Dict, Optional, Tuple

import httpx
from fastapi import HTTPException
from sqlalchemy.orm import Session

from .database import now
from .models import Ledger, Need, Payout
from .payments import PAYPAL_BASE_URL, amount_string, get_access_token, paypal_request

PROHIBITED_PAYOUT_TERMS = [
    "alcohol", "beer", "wine", "liquor", "tobacco", "cigarette", "vape",
    "gambling", "crypto", "bitcoin", "vacation", "personal luxury", "entertainment",
]


def validate_payout_compliance(purpose_note: str, need: Need) -> Tuple[bool, Optional[str]]:
    del need
    lowered = purpose_note.lower().strip()
    if len(lowered) < 5:
        return False, "A descriptive relief purpose is required."
    for term in PROHIBITED_PAYOUT_TERMS:
        if term in lowered:
            return False, f"Prohibited term detected: '{term}'."
    return True, None


def map_payout_status(batch_status: Optional[str], item_status: Optional[str]) -> str:
    """Only an item-level SUCCESS means funds are considered disbursed."""
    batch = (batch_status or "").upper()
    item = (item_status or "").upper()
    if item == "SUCCESS" and batch == "SUCCESS":
        return "SUCCESS"
    if batch == "DENIED" or item in {"FAILED", "RETURNED", "BLOCKED", "CANCELED", "CANCELLED"}:
        return "FAILED"
    return "PENDING"


async def get_paypal_payout_status(batch_id: str, sender_item_id: str) -> Dict[str, Any]:
    if os.getenv("PAYPAL_ENVIRONMENT", "sandbox") != "sandbox":
        raise HTTPException(status_code=503, detail="Only PayPal sandbox payouts are enabled")
    async with httpx.AsyncClient(timeout=20) as client:
        data = await paypal_request(client, "GET", f"/v1/payments/payouts/{batch_id}")
    header = data.get("batch_header") or {}
    item = next((x for x in data.get("items", []) if (x.get("payout_item") or {}).get("sender_item_id") == sender_item_id), None)
    if item is None:
        item = next((x for x in data.get("items", []) if x.get("payout_item_id") == sender_item_id), None)
    item_status = (item or {}).get("transaction_status") or ((item or {}).get("payout_item") or {}).get("transaction_status")
    if item is None and len(data.get("items", [])) == 1:
        item = data["items"][0]
        item_status = item.get("transaction_status") or (item.get("payout_item") or {}).get("transaction_status")
    return {
        "payout_batch_id": header.get("payout_batch_id", batch_id),
        "batch_status": header.get("batch_status"),
        "payout_item_id": (item or {}).get("payout_item_id"),
        "item_status": item_status,
        "status": map_payout_status(header.get("batch_status"), item_status),
    }


async def execute_paypal_payout(
    recipient_email: str,
    amount_minor: int,
    currency: str,
    note: str,
    sender_batch_id: str,
    sender_item_id: str,
    request_id: str,
) -> Dict[str, Any]:
    """Create one real sandbox payout; never substitute a simulated success."""
    if os.getenv("PAYPAL_ENVIRONMENT", "sandbox") != "sandbox":
        raise HTTPException(status_code=503, detail="Only PayPal sandbox payouts are enabled")
    payload = {
        "sender_batch_header": {
            "sender_batch_id": sender_batch_id,
            "email_subject": "ReliefRail sandbox relief disbursement",
            "email_message": "A sandbox relief disbursement was initiated by ReliefRail.",
        },
        "items": [{
            "recipient_type": "EMAIL",
            "amount": {"value": amount_string(amount_minor), "currency": currency},
            "note": note,
            "sender_item_id": sender_item_id,
            "receiver": recipient_email,
        }],
    }
    async with httpx.AsyncClient(timeout=20) as client:
        data = await paypal_request(
            client, "POST", "/v1/payments/payouts", payload, request_id=request_id
        )
        header = data.get("batch_header") or {}
        batch_id = header.get("payout_batch_id")
        if not batch_id:
            raise HTTPException(status_code=502, detail="PayPal accepted no identifiable payout batch")
    try:
        details = await get_paypal_payout_status(batch_id, sender_item_id)
    except (httpx.HTTPError, HTTPException):
        # Creation succeeded and the batch ID is known. Persist it and let the worker poll later.
        details = {
            "payout_batch_id": batch_id,
            "payout_item_id": None,
            "status": "PENDING",
        }
    return {**details, "fee_minor": 0}


def apply_payout_status(session: Session, payout: Payout, status: str) -> None:
    """Settle or release the held pool amount after provider status is authoritative."""
    if status == "PENDING" or payout.status in {"SUCCESS", "FAILED"}:
        return
    if status == "SUCCESS":
        if session.query(Ledger.id).filter_by(reference=f"paypal:payout:spend:{payout.id}").first():
            payout.status = "SUCCESS"
            return
        spend = Ledger(
            campaign_id=payout.campaign_id,
            need_id=payout.need_id,
            kind="spend",
            amount_minor=payout.amount_minor,
            reference=f"paypal:payout:spend:{payout.id}",
        )
        session.add(spend)
        session.flush()
        payout.ledger_id = spend.id
        payout.status = "SUCCESS"
        payout.created_at = payout.created_at or now()
    elif status == "FAILED":
        if session.query(Ledger.id).filter_by(reference=f"paypal:payout:release:{payout.id}").first():
            payout.status = "FAILED"
            return
        session.add(Ledger(
            campaign_id=payout.campaign_id,
            need_id=payout.need_id,
            kind="release",
            amount_minor=payout.amount_minor,
            reference=f"paypal:payout:release:{payout.id}",
        ))
        payout.status = "FAILED"
