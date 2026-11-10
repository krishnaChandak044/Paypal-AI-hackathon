from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import actor, campaign, log, require
from ..database import get_db, now
from ..models import Ledger, Member, Receipt
from ..schemas import ReceiptIn

router = APIRouter(tags=["Receipts & Purchase Reconciliation"])


@router.post("/spending/{ledger_id}/receipt")
def attach_receipt(
    ledger_id: str,
    body: ReceiptIn,
    session: Session = Depends(get_db),
    current_member: Member = Depends(actor),
):
    """Attaches an itemized receipt or proof of purchase to an offline spending event."""
    require(current_member)

    entry = session.get(Ledger, ledger_id)
    if not entry or entry.kind != "spend":
        raise HTTPException(status_code=404, detail="Spending record not found")

    campaign(session, entry.campaign_id, current_member)

    existing = session.scalar(
        select(Receipt.id).where(Receipt.ledger_id == ledger_id)
    )
    if existing:
        raise HTTPException(status_code=409, detail="Receipt already attached")

    receipt = Receipt(ledger_id=ledger_id, **body.model_dump())
    session.add(receipt)
    session.flush()

    log(session, current_member, "receipt.attached", receipt.id)
    session.commit()

    return {"id": receipt.id, "status": receipt.status}


@router.post("/receipts/{receipt_id}/reconcile")
def reconcile_receipt(
    receipt_id: str,
    session: Session = Depends(get_db),
    current_member: Member = Depends(actor),
):
    """Marks an attached receipt as reconciled after finance verification (Admin / Finance)."""
    require(current_member, ("admin", "finance"))

    receipt = session.get(Receipt, receipt_id)
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")

    entry = session.get(Ledger, receipt.ledger_id)
    campaign(session, entry.campaign_id, current_member)

    if receipt.status != "unreconciled":
        raise HTTPException(status_code=409, detail="Already reconciled")

    receipt.status = "reconciled"
    receipt.reconciled_by = current_member.id
    receipt.reconciled_at = now()

    log(session, current_member, "receipt.reconciled", receipt.id)
    session.commit()

    return {"status": receipt.status}


@router.get("/campaigns/{campaign_id}/unreconciled")
def list_unreconciled_spending(
    campaign_id: str,
    session: Session = Depends(get_db),
    current_member: Member = Depends(actor),
):
    """Lists all spending entries that lack an approved, reconciled receipt (Admin / Finance)."""
    require(current_member, ("admin", "finance"))
    campaign(session, campaign_id, current_member)

    spending_entries = session.scalars(
        select(Ledger).where(Ledger.campaign_id == campaign_id, Ledger.kind == "spend")
    ).all()

    unreconciled_items = []
    for entry in spending_entries:
        receipt = session.scalar(
            select(Receipt).where(Receipt.ledger_id == entry.id)
        )
        if not receipt or receipt.status != "reconciled":
            unreconciled_items.append(
                {
                    "ledger_id": entry.id,
                    "amount_minor": entry.amount_minor,
                    "receipt_status": receipt.status if receipt else "missing",
                }
            )

    return unreconciled_items

