from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import actor, campaign, log, require
from ..database import engine, get_db
from ..ledger import calculate_balance
from ..models import AidRequest, Ledger, Member, Need
from ..schemas import AllocationIn, SettlementIn

router = APIRouter(tags=["Allocations & Ledger Settlements"])


@router.post("/needs/{need_id}/reserve")
def reserve_funds(
    need_id: str,
    body: AllocationIn,
    session: Session = Depends(get_db),
    current_member: Member = Depends(actor),
):
    """Reserves available emergency pool funds for an approved relief need."""
    require(current_member, ("admin", "finance"))

    session.rollback()
    if engine.dialect.name == "sqlite":
        session.connection().exec_driver_sql("BEGIN IMMEDIATE")

    need = session.get(Need, need_id)
    if not need:
        raise HTTPException(status_code=404, detail="Need not found")

    req = session.get(AidRequest, need.request_id)
    campaign(session, req.campaign_id, current_member)

    if need.status != "approved":
        raise HTTPException(status_code=409, detail="Need requires human approval")

    duplicate = session.scalar(
        select(Ledger.id).where(Ledger.reference == body.reference)
    )
    if duplicate:
        raise HTTPException(status_code=409, detail="Duplicate reference")

    available = calculate_balance(session, req.campaign_id)["available_minor"]
    if body.amount_minor > available:
        raise HTTPException(status_code=409, detail="Insufficient available funds")

    existing_reserves = sum(
        e.amount_minor
        for e in session.scalars(
            select(Ledger).where(Ledger.need_id == need_id, Ledger.kind == "reserve")
        ).all()
    ) - sum(
        e.amount_minor
        for e in session.scalars(
            select(Ledger).where(Ledger.need_id == need_id, Ledger.kind == "release")
        ).all()
    )

    if body.amount_minor + existing_reserves > need.amount_minor:
        raise HTTPException(status_code=409, detail="Exceeds approved need amount")

    entry = Ledger(
        campaign_id=req.campaign_id,
        need_id=need_id,
        kind="reserve",
        amount_minor=body.amount_minor,
        reference=body.reference,
    )
    session.add(entry)
    session.flush()

    log(session, current_member, "allocation.reserved", entry.id)
    session.commit()

    return {"id": entry.id}


@router.post("/needs/{need_id}/spend")
def record_spend(
    need_id: str,
    body: SettlementIn,
    session: Session = Depends(get_db),
    current_member: Member = Depends(actor),
):
    """Records spending against a reserved allocation for an approved need."""
    require(current_member, ("admin", "finance"))

    session.rollback()
    if engine.dialect.name == "sqlite":
        session.connection().exec_driver_sql("BEGIN IMMEDIATE")

    need = session.get(Need, need_id)
    if not need:
        raise HTTPException(status_code=404, detail="Need not found")

    req = session.get(AidRequest, need.request_id)
    campaign(session, req.campaign_id, current_member)

    entries = session.scalars(
        select(Ledger).where(Ledger.need_id == need_id)
    ).all()
    held = sum(e.amount_minor for e in entries if e.kind == "reserve") - sum(
        e.amount_minor for e in entries if e.kind in ("release", "spend")
    )

    if body.amount_minor > held:
        raise HTTPException(status_code=409, detail="Amount exceeds reservation")

    duplicate = session.scalar(
        select(Ledger.id).where(Ledger.reference == body.reference)
    )
    if duplicate:
        raise HTTPException(status_code=409, detail="Duplicate reference")

    entry = Ledger(
        campaign_id=req.campaign_id,
        need_id=need_id,
        kind="spend",
        amount_minor=body.amount_minor,
        reference=body.reference,
    )
    session.add(entry)
    session.flush()

    log(session, current_member, f"fulfillment.manual_spend:{body.note}", entry.id)
    session.commit()

    return {"id": entry.id}


@router.post("/needs/{need_id}/release")
def release_reservation(
    need_id: str,
    body: SettlementIn,
    session: Session = Depends(get_db),
    current_member: Member = Depends(actor),
):
    """Releases an unused fund reservation back to the campaign's available pool."""
    require(current_member, ("admin", "finance"))

    session.rollback()
    if engine.dialect.name == "sqlite":
        session.connection().exec_driver_sql("BEGIN IMMEDIATE")

    need = session.get(Need, need_id)
    if not need:
        raise HTTPException(status_code=404, detail="Need not found")

    req = session.get(AidRequest, need.request_id)
    campaign(session, req.campaign_id, current_member)

    entries = session.scalars(
        select(Ledger).where(Ledger.need_id == need_id)
    ).all()
    held = sum(e.amount_minor for e in entries if e.kind == "reserve") - sum(
        e.amount_minor for e in entries if e.kind in ("release", "spend")
    )

    if body.amount_minor > held:
        raise HTTPException(status_code=409, detail="Amount exceeds reservation")

    duplicate = session.scalar(
        select(Ledger.id).where(Ledger.reference == body.reference)
    )
    if duplicate:
        raise HTTPException(status_code=409, detail="Duplicate reference")

    entry = Ledger(
        campaign_id=req.campaign_id,
        need_id=need_id,
        kind="release",
        amount_minor=body.amount_minor,
        reference=body.reference,
    )
    session.add(entry)
    session.flush()

    log(session, current_member, f"allocation.released:{body.note}", entry.id)
    session.commit()

    return {"id": entry.id}

