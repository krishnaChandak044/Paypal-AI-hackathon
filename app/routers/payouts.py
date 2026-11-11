import json
import os
from typing import List

from fastapi import APIRouter, Depends, HTTPException
import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import actor, campaign, log, require
from ..database import engine, get_db, now, uid
from ..ledger import calculate_balance
from ..models import AidRequest, Ledger, Member, Need, Payout
from ..payouts import (
    apply_payout_status,
    execute_paypal_payout,
    get_paypal_payout_status,
    screen_payout_purpose_keywords,
)
from ..schemas import DisbursePayoutIn, PayoutOut, SimulateCrisisIn

router = APIRouter(tags=["PayPal Fast-Grants & Outflow Disbursal"])


@router.post("/payouts/{payout_id}/explain")
async def explain_payout_status(
    payout_id: str,
    session: Session = Depends(get_db),
    current_member: Member = Depends(actor),
):
    """Explain synthetic payout state from sanitized ledger/provider facts; never changes funds."""
    require(current_member)
    payout = session.get(Payout, payout_id)
    if not payout:
        raise HTTPException(status_code=404, detail="Payout not found")
    campaign(session, payout.campaign_id, current_member)
    need = session.get(Need, payout.need_id)
    request = session.get(AidRequest, need.request_id) if need else None
    if not request or not request.is_synthetic:
        raise HTTPException(status_code=403, detail="AI payout explanations are limited to synthetic demo cases")
    if os.getenv("ALLOW_SYNTHETIC_AI", "").lower() != "true":
        raise HTTPException(status_code=403, detail="Synthetic AI demo mode is disabled")
    api_key = os.getenv("META_MODEL_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="Meta API key missing")

    facts = {
        "provider": "PayPal Sandbox",
        "status": payout.status,
        "amount": f"{payout.amount_minor / 100:.2f} {payout.currency}",
        "provider_batch_received": payout.payout_batch_id != payout.sender_batch_id,
        "provider_item_received": bool(payout.payout_item_id),
        "reservation_recorded": bool(session.scalar(select(Ledger.id).where(Ledger.reference == f"paypal:payout:reserve:{payout.id}"))),
        "spend_recorded": bool(session.scalar(select(Ledger.id).where(Ledger.reference == f"paypal:payout:spend:{payout.id}"))),
        "reserve_released": bool(session.scalar(select(Ledger.id).where(Ledger.reference == f"paypal:payout:release:{payout.id}"))),
    }
    payload = {
        "model": os.getenv("AI_MODEL", "muse-spark-1.3"),
        "messages": [
            {"role": "system", "content": (
                "Explain a PayPal Sandbox payout state using only the supplied JSON facts. "
                "Return JSON with short string fields explanation and suggested_next_step. "
                "Never claim delivery, eligibility, compliance, or fraud. Never propose retry for pending/unknown states. "
                "This is advisory text only and must not imply that you changed funds or ledger state."
            )},
            {"role": "user", "content": json.dumps(facts)},
        ],
    }
    try:
        async with httpx.AsyncClient(timeout=25) as client:
            response = await client.post(
                "https://api.meta.ai/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}"},
                json=payload,
            )
            response.raise_for_status()
            result = json.loads(response.json()["choices"][0]["message"]["content"])
        if not isinstance(result.get("explanation"), str) or not isinstance(result.get("suggested_next_step"), str):
            raise ValueError("Malformed explanation")
        return {
            "status": "advisory",
            "facts": facts,
            "explanation": result["explanation"][:1000],
            "suggested_next_step": result["suggested_next_step"][:500],
            "disclaimer": "AI generated this explanation from sanitized synthetic case facts. It did not alter the payout or ledger.",
        }
    except (httpx.HTTPError, KeyError, ValueError, TypeError) as exc:
        raise HTTPException(status_code=502, detail="AI payout explanation unavailable or invalid") from exc


@router.post("/needs/{need_id}/payout", response_model=PayoutOut)
async def disburse_payout(
    need_id: str,
    body: DisbursePayoutIn,
    session: Session = Depends(get_db),
    current_member: Member = Depends(actor),
):
    """Disburses an emergency fast-grant directly to a recipient or supplier via PayPal Payouts API v1."""
    require(current_member, ("admin", "finance", "organizer"))

    session.rollback()
    if engine.dialect.name == "sqlite":
        session.connection().exec_driver_sql("BEGIN IMMEDIATE")

    need = session.get(Need, need_id)
    if not need:
        raise HTTPException(status_code=404, detail="Need not found")

    req = session.get(AidRequest, need.request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Associated aid request not found")

    c = campaign(session, req.campaign_id, current_member)

    if need.status != "approved":
        raise HTTPException(status_code=409, detail="Need must be in 'approved' status prior to disbursement")

    # 1. AI & Policy Compliance Validation
    is_compliant, reason = screen_payout_purpose_keywords(body.purpose_note, need)
    if not is_compliant:
        raise HTTPException(status_code=400, detail=f"Basic purpose-text screen flagged the request: {reason}")

    # Include other holds so two concurrent payouts cannot over-commit one need.
    entries = session.scalars(select(Ledger).where(Ledger.need_id == need.id)).all()
    committed = sum(e.amount_minor for e in entries if e.kind == "reserve") - sum(
        e.amount_minor for e in entries if e.kind in ("release", "spend")
    )
    remaining_budget = need.amount_minor - committed

    if body.amount_minor > remaining_budget:
        raise HTTPException(
            status_code=409,
            detail=f"Disbursement (${body.amount_minor / 100:.2f}) exceeds remaining approved budget (${remaining_budget / 100:.2f})",
        )

    # 3. Check pool funds
    pool = calculate_balance(session, req.campaign_id)
    if body.amount_minor > pool["available_minor"]:
        raise HTTPException(
            status_code=409,
            detail=f"Disbursement (${body.amount_minor / 100:.2f}) exceeds available pool balance (${pool['available_minor'] / 100:.2f})",
        )

    # Reserve before making the external call. A timeout stays held for reconciliation.
    payout_id = uid()
    sender_batch_id = f"RELIEF-{payout_id.replace('-', '')[:20].upper()}"
    sender_item_id = f"ITEM-{payout_id.replace('-', '')[:20].upper()}"
    hold = Ledger(
        campaign_id=req.campaign_id,
        need_id=need.id,
        kind="reserve",
        amount_minor=body.amount_minor,
        reference=f"paypal:payout:reserve:{payout_id}",
    )
    session.add(hold)
    session.flush()
    payout_record = Payout(
        id=payout_id,
        campaign_id=req.campaign_id,
        need_id=need.id,
        ledger_id=hold.id,
        payout_batch_id=sender_batch_id,
        sender_batch_id=sender_batch_id,
        sender_item_id=sender_item_id,
        payout_item_id=None,
        recipient_email=body.recipient_email,
        recipient_name=body.recipient_name,
        recipient_type=body.recipient_type,
        amount_minor=body.amount_minor,
        fee_minor=0,
        currency=c.currency,
        status="PENDING",
        mode="paypal_sandbox",
        purpose_note=body.purpose_note,
        created_at=now(),
    )
    session.add(payout_record)
    session.flush()

    log(session, current_member, "payout.created_pending", payout_record.id)
    session.commit()

    try:
        result = await execute_paypal_payout(
            recipient_email=body.recipient_email,
            amount_minor=body.amount_minor,
            currency=c.currency,
            note=body.purpose_note,
            sender_batch_id=sender_batch_id,
            sender_item_id=sender_item_id,
            request_id=payout_id,
        )
        payout_record.payout_batch_id = result["payout_batch_id"]
        payout_record.payout_item_id = result.get("payout_item_id")
        payout_record.fee_minor = result.get("fee_minor", 0)
        apply_payout_status(session, payout_record, result["status"])
        log(session, current_member, f"payout.provider_status:{result['status'].lower()}", payout_record.id)
        session.commit()
    except HTTPException as exc:
        session.rollback()
        payout_record = session.get(Payout, payout_id)
        if not payout_record:
            raise
        if exc.status_code == 503:
            apply_payout_status(session, payout_record, "FAILED")
        else:
            payout_record.status = "RECONCILIATION_REQUIRED"
        session.commit()
    except (httpx.HTTPError, TimeoutError):
        session.rollback()
        payout_record = session.get(Payout, payout_id)
        if payout_record:
            payout_record.status = "RECONCILIATION_REQUIRED"
            session.commit()
    payout_record = session.get(Payout, payout_id)

    return PayoutOut(
        payout_id=payout_record.id,
        need_id=need.id,
        ledger_id=payout_record.ledger_id,
        payout_batch_id=payout_record.payout_batch_id if payout_record.payout_batch_id != payout_record.sender_batch_id else None,
        payout_item_id=payout_record.payout_item_id,
        recipient_email=body.recipient_email,
        recipient_name=body.recipient_name,
        recipient_type=body.recipient_type,
        amount_minor=body.amount_minor,
        fee_minor=payout_record.fee_minor,
        currency=c.currency,
        status=payout_record.status,
        purpose_note=body.purpose_note,
        created_at=payout_record.created_at,
        mode=payout_record.mode,
    )


@router.get("/campaigns/{campaign_id}/payouts", response_model=List[PayoutOut])
def list_campaign_payouts(
    campaign_id: str,
    session: Session = Depends(get_db),
    current_member: Member = Depends(actor),
):
    """Lists all historical PayPal fast-grant disbursements for a campaign."""
    require(current_member)
    campaign(session, campaign_id, current_member)

    payouts = session.scalars(
        select(Payout)
        .where(Payout.campaign_id == campaign_id)
        .order_by(Payout.created_at.desc())
        .limit(100)
    ).all()

    return [
        PayoutOut(
            payout_id=p.id,
            need_id=p.need_id,
            ledger_id=p.ledger_id,
            payout_batch_id=p.payout_batch_id if p.payout_batch_id != p.sender_batch_id else None,
            payout_item_id=p.payout_item_id,
            recipient_email=p.recipient_email,
            recipient_name=p.recipient_name,
            recipient_type=p.recipient_type,
            amount_minor=p.amount_minor,
            fee_minor=p.fee_minor,
            currency=p.currency,
            status=p.status,
            purpose_note=p.purpose_note,
            created_at=p.created_at,
            mode=p.mode,
        )
        for p in payouts
    ]


@router.post("/payouts/{payout_id}/reconcile", response_model=PayoutOut)
async def reconcile_payout(
    payout_id: str,
    session: Session = Depends(get_db),
    current_member: Member = Depends(actor),
):
    """Refresh a payout from PayPal; unresolved or legacy amounts remain reserved."""
    require(current_member, ("admin", "finance"))
    payout = session.get(Payout, payout_id)
    if not payout:
        raise HTTPException(status_code=404, detail="Payout not found")
    campaign(session, payout.campaign_id, current_member)
    if payout.status in {"SUCCESS", "FAILED"}:
        raise HTTPException(status_code=409, detail="Payout already has a terminal provider status")
    if payout.payout_batch_id == payout.sender_batch_id:
        raise HTTPException(status_code=409, detail="PayPal has not returned a batch ID for this request")
    item_key = payout.sender_item_id or payout.payout_item_id
    if not item_key:
        raise HTTPException(status_code=409, detail="Payout has no provider item reference")

    result = await get_paypal_payout_status(payout.payout_batch_id, item_key)
    payout.payout_item_id = result.get("payout_item_id") or payout.payout_item_id
    if result.get("item_status") or result["status"] == "FAILED":
        apply_payout_status(session, payout, result["status"])
        if result["status"] == "PENDING":
            payout.status = "PENDING"
    session.commit()
    return PayoutOut(
        payout_id=payout.id,
        need_id=payout.need_id,
        ledger_id=payout.ledger_id,
        payout_batch_id=payout.payout_batch_id,
        payout_item_id=payout.payout_item_id,
        recipient_email=payout.recipient_email,
        recipient_name=payout.recipient_name,
        recipient_type=payout.recipient_type,
        amount_minor=payout.amount_minor,
        fee_minor=payout.fee_minor,
        currency=payout.currency,
        status=payout.status,
        purpose_note=payout.purpose_note,
        created_at=payout.created_at,
        mode=payout.mode,
    )


@router.post("/payouts/{payout_id}/retry", response_model=PayoutOut)
async def retry_ambiguous_payout(
    payout_id: str,
    session: Session = Depends(get_db),
    current_member: Member = Depends(actor),
):
    """Safely repeat an ambiguous create call with the original PayPal idempotency IDs."""
    require(current_member, ("admin", "finance"))
    payout = session.get(Payout, payout_id)
    if not payout:
        raise HTTPException(status_code=404, detail="Payout not found")
    campaign(session, payout.campaign_id, current_member)
    if payout.status not in {"PENDING", "RECONCILIATION_REQUIRED"}:
        raise HTTPException(status_code=409, detail="Only pending or ambiguous payouts can be retried")
    if payout.payout_batch_id != payout.sender_batch_id:
        raise HTTPException(status_code=409, detail="A PayPal batch exists; use reconciliation instead")
    if not payout.sender_batch_id or not payout.sender_item_id:
        raise HTTPException(status_code=409, detail="Payout is missing its original idempotency references")

    try:
        result = await execute_paypal_payout(
            recipient_email=payout.recipient_email,
            amount_minor=payout.amount_minor,
            currency=payout.currency,
            note=payout.purpose_note,
            sender_batch_id=payout.sender_batch_id,
            sender_item_id=payout.sender_item_id,
            request_id=payout.id,
        )
        payout.payout_batch_id = result["payout_batch_id"]
        payout.payout_item_id = result.get("payout_item_id") or payout.payout_item_id
        payout.fee_minor = result.get("fee_minor", 0)
        apply_payout_status(session, payout, result["status"])
        if result["status"] == "PENDING":
            payout.status = "PENDING"
    except (HTTPException, httpx.HTTPError, TimeoutError):
        payout.status = "RECONCILIATION_REQUIRED"
    session.commit()
    return PayoutOut(
        payout_id=payout.id,
        need_id=payout.need_id,
        ledger_id=payout.ledger_id,
        payout_batch_id=payout.payout_batch_id if payout.payout_batch_id != payout.sender_batch_id else None,
        payout_item_id=payout.payout_item_id,
        recipient_email=payout.recipient_email,
        recipient_name=payout.recipient_name,
        recipient_type=payout.recipient_type,
        amount_minor=payout.amount_minor,
        fee_minor=payout.fee_minor,
        currency=payout.currency,
        status=payout.status,
        purpose_note=payout.purpose_note,
        created_at=payout.created_at,
        mode=payout.mode,
    )


@router.post("/campaigns/{campaign_id}/simulate-crisis")
def simulate_crisis_scenario(
    campaign_id: str,
    body: SimulateCrisisIn,
    session: Session = Depends(get_db),
    current_member: Member = Depends(actor),
):
    """Injects a realistic multi-need crisis influx to immediately test coordination, PayPal payouts, and receipt audits."""
    require(current_member)
    c = campaign(session, campaign_id, current_member)

    scenario_sets = {
        "flash_flood_wave": [
            "Synthetic case: A senior household in a fictional riverside zone reports a flooded ground floor and asks for backup power for essential medical equipment.",
            "Synthetic case: A displaced family at a fictional school shelter asks for infant formula, diapers, and warm bedding.",
            "Synthetic case: A volunteer crew at a fictional creek crossing asks for a replacement water pump and safety waders.",
        ],
        "power_outage_freeze": [
            "Synthetic case: A household in a fictional neighborhood reports a prolonged winter power outage and asks for safe temporary heating and blankets.",
            "Synthetic case: A fictional community shelter asks for battery lanterns, charging packs, and bottled water for overnight guests.",
            "Synthetic case: A volunteer team in a fictional district asks for insulated gloves and portable lighting for evening welfare checks.",
        ],
        "urban_wildfire": [
            "Synthetic case: A household in a fictional evacuation zone asks for temporary lodging, drinking water, and respiratory masks.",
            "Synthetic case: A fictional reception center asks for cots, blankets, and hygiene supplies for newly displaced residents.",
            "Synthetic case: A volunteer transport team in a fictional district asks for fuel vouchers and first-aid supplies for evacuation support.",
        ],
    }
    scenarios = scenario_sets[body.scenario]

    created_ids = []
    for message in scenarios:
        existing = session.scalar(
            select(AidRequest).where(
                AidRequest.campaign_id == c.id,
                AidRequest.is_synthetic.is_(True),
                AidRequest.message == message,
                AidRequest.status != "merged",
            )
        )
        if existing:
            created_ids.append({"request_id": existing.id, "status": existing.status, "reused": True})
            continue
        req = AidRequest(
            id=uid(),
            campaign_id=c.id,
            message=message,
            status="received",
            is_synthetic=True,
            created_at=now(),
        )
        session.add(req)
        session.flush()
        created_ids.append({"request_id": req.id, "status": req.status, "reused": False})

    log(session, current_member, f"simulation.crisis_injected:{body.scenario}", c.id)
    session.commit()

    return {
        "status": "crisis_injected",
        "scenario": body.scenario,
        "items_created": sum(1 for item in created_ids if not item["reused"]),
        "items_reused": sum(1 for item in created_ids if item["reused"]),
        "details": created_ids,
    }
