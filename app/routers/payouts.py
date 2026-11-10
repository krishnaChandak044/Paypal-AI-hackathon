from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import actor, campaign, log, require
from ..database import engine, get_db, now, uid
from ..ledger import calculate_balance
from ..models import AidRequest, Ledger, Member, Need, Payout
from ..payouts import execute_paypal_payout, validate_payout_compliance
from ..schemas import DisbursePayoutIn, PayoutOut, SimulateCrisisIn

router = APIRouter(tags=["PayPal Fast-Grants & Outflow Disbursal"])


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
    is_compliant, reason = validate_payout_compliance(body.purpose_note, need)
    if not is_compliant:
        raise HTTPException(status_code=400, detail=f"Compliance check failed: {reason}")

    # 2. Check remaining need amount
    entries = session.scalars(select(Ledger).where(Ledger.need_id == need.id)).all()
    already_spent = sum(e.amount_minor for e in entries if e.kind == "spend")
    remaining_budget = need.amount_minor - already_spent

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

    # 4. Execute PayPal Payout (live sandbox or simulated sandbox)
    payout_res = await execute_paypal_payout(
        recipient_email=body.recipient_email,
        amount_minor=body.amount_minor,
        currency=c.currency,
        note=f"{body.purpose_note} (Need: {need.description[:30]})",
    )

    batch_id = payout_res["payout_batch_id"]
    item_id = payout_res.get("payout_item_id")
    payout_mode = payout_res.get("mode", "sandbox")
    fee_minor = payout_res.get("fee_minor", 25)

    # 5. Ledger Double-Entry Outflow Settlement
    ledger_entry = Ledger(
        campaign_id=req.campaign_id,
        need_id=need.id,
        kind="spend",
        amount_minor=body.amount_minor,
        reference=f"PAYPAL-PAYOUT-{batch_id[:16]}-{uid()[:4]}",
    )
    session.add(ledger_entry)
    session.flush()

    # 6. Record Payout Details
    payout_record = Payout(
        id=uid(),
        campaign_id=req.campaign_id,
        need_id=need.id,
        ledger_id=ledger_entry.id,
        payout_batch_id=batch_id,
        payout_item_id=item_id,
        recipient_email=body.recipient_email,
        recipient_name=body.recipient_name,
        recipient_type=body.recipient_type,
        amount_minor=body.amount_minor,
        fee_minor=fee_minor,
        currency=c.currency,
        status="SUCCESS",
        purpose_note=body.purpose_note,
        created_at=now(),
    )
    session.add(payout_record)
    session.flush()

    log(session, current_member, f"payout.disbursed:{batch_id}", payout_record.id)
    session.commit()

    return PayoutOut(
        payout_id=payout_record.id,
        need_id=need.id,
        ledger_id=ledger_entry.id,
        payout_batch_id=batch_id,
        payout_item_id=item_id,
        recipient_email=body.recipient_email,
        recipient_name=body.recipient_name,
        recipient_type=body.recipient_type,
        amount_minor=body.amount_minor,
        fee_minor=fee_minor,
        currency=c.currency,
        status="SUCCESS",
        purpose_note=body.purpose_note,
        created_at=payout_record.created_at,
        mode=payout_mode,
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
            payout_batch_id=p.payout_batch_id,
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
            mode="paypal_sandbox",
        )
        for p in payouts
    ]


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

    scenarios = [
        {
            "message": "Senior household at 104 Riverside Drive with flooded ground floor. Power cut off; urgently needs portable generator to run medical CPAP machine and electric radiator.",
            "need_desc": "Portable emergency power generator & fuel canister",
            "amount_minor": 18500,
        },
        {
            "message": "Young family of four displaced to high school gym shelter. Twins require hypoallergenic formula, diapers size 3, and thermal sleeping fleece.",
            "need_desc": "Hypoallergenic infant formula, diapers & thermal bedding",
            "amount_minor": 8500,
        },
        {
            "message": "Volunteer search & rescue team clearing Riverbend Creek bridge. Sump pump burned out; requires replacement high-capacity pump and heavy safety waders.",
            "need_desc": "1/2 HP Sump pump & safety waders for volunteer crew",
            "amount_minor": 14000,
        },
    ]

    created_ids = []
    for s in scenarios:
        req = AidRequest(
            id=uid(),
            campaign_id=c.id,
            message=s["message"],
            status="approved",
            created_at=now(),
        )
        session.add(req)
        session.flush()

        need = Need(
            id=uid(),
            request_id=req.id,
            description=s["need_desc"],
            amount_minor=s["amount_minor"],
            status="approved",
        )
        session.add(need)
        session.flush()
        created_ids.append({"request_id": req.id, "need_id": need.id, "description": s["need_desc"]})

    log(session, current_member, f"simulation.crisis_injected:{body.scenario}", c.id)
    session.commit()

    return {
        "status": "crisis_injected",
        "scenario": body.scenario,
        "items_created": len(created_ids),
        "details": created_ids,
    }
