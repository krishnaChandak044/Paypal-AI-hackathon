import json
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import actor, campaign, log, require
from ..database import engine, get_db, now, uid
from ..ledger import calculate_balance
from ..models import AidRequest, Ledger, Member, Need, Receipt, ReceiptAudit
from ..receipt_scanner import evaluate_receipt_audit, extract_receipt_from_image_or_sample
from ..schemas import ApplyAuditIn, ReceiptAuditOut, ReceiptIn, ReceiptScanIn

router = APIRouter(tags=["Receipts & Purchase Reconciliation"])


@router.post("/receipts/scan-and-audit", response_model=ReceiptAuditOut)
async def scan_and_audit_receipt(
    body: ReceiptScanIn,
    session: Session = Depends(get_db),
    current_member: Member = Depends(actor),
):
    """Executes Multimodal AI extraction & deterministic audit policy validation on a receipt image or sample.

    Extracts line items, validates math, detects prohibited goods (alcohol, tobacco, luxury items),
    and cross-checks the expenditure against approved need budgets.
    """
    require(current_member)
    c = campaign(session, body.campaign_id, current_member)

    target_need = None
    if body.need_id:
        target_need = session.get(Need, body.need_id)
        if not target_need:
            raise HTTPException(status_code=404, detail="Target need not found")

    # 1. Extract raw receipt information via AI vision or scenario sample
    raw_receipt = await extract_receipt_from_image_or_sample(
        image_base64=body.image_base64,
        sample_id=body.sample_id,
    )

    # 2. Run deterministic audit policy validation
    items_out, anomalies, eligible_total, ineligible_total, verdict = evaluate_receipt_audit(
        raw_receipt,
        need=target_need,
    )

    vendor = raw_receipt.get("vendor", "Local Merchant")
    receipt_reference = raw_receipt.get("receipt_reference", f"RCPT-{now()[:10]}")
    occurred_at = raw_receipt.get("occurred_at", now()[:10])
    total_minor = raw_receipt.get("total_minor", eligible_total + ineligible_total)
    tax_minor = raw_receipt.get("tax_minor", 0)

    # 3. Persist audit trail in database
    audit_record = ReceiptAudit(
        campaign_id=body.campaign_id,
        need_id=body.need_id,
        vendor=vendor,
        receipt_reference=receipt_reference,
        occurred_at=occurred_at,
        total_minor=total_minor,
        tax_minor=tax_minor,
        eligible_total_minor=eligible_total,
        ineligible_total_minor=ineligible_total,
        items_json=json.dumps([item.model_dump() for item in items_out]),
        anomalies_json=json.dumps([a.model_dump() for a in anomalies]),
        verdict=verdict,
        confidence=0.96,
    )
    session.add(audit_record)
    session.flush()

    log(session, current_member, f"receipt.ai_audited:{verdict}", audit_record.id)
    session.commit()

    need_comparison = None
    if target_need:
        diff = eligible_total - target_need.amount_minor
        need_comparison = {
            "need_id": target_need.id,
            "description": target_need.description,
            "approved_minor": target_need.amount_minor,
            "eligible_total_minor": eligible_total,
            "diff_minor": diff,
            "status": "within_budget" if diff <= 0 else "over_budget",
        }

    return ReceiptAuditOut(
        audit_id=audit_record.id,
        vendor=vendor,
        receipt_reference=receipt_reference,
        occurred_at=occurred_at,
        total_minor=total_minor,
        tax_minor=tax_minor,
        eligible_total_minor=eligible_total,
        ineligible_total_minor=ineligible_total,
        items=items_out,
        anomalies=anomalies,
        verdict=verdict,
        confidence=audit_record.confidence,
        need_comparison=need_comparison,
    )


@router.post("/receipts/audit/apply")
def apply_audited_receipt(
    body: ApplyAuditIn,
    session: Session = Depends(get_db),
    current_member: Member = Depends(actor),
):
    """Applies an approved AI-audited receipt to the ledger and reconciles the spend event (Admin / Finance)."""
    require(current_member, ("admin", "finance"))

    session.rollback()
    if engine.dialect.name == "sqlite":
        session.connection().exec_driver_sql("BEGIN IMMEDIATE")

    audit = session.get(ReceiptAudit, body.audit_id)
    if not audit:
        raise HTTPException(status_code=404, detail="Audit record not found")

    need = session.get(Need, body.need_id)
    if not need:
        raise HTTPException(status_code=404, detail="Need not found")

    req = session.get(AidRequest, need.request_id)
    campaign(session, req.campaign_id, current_member)

    # Calculate current held reservation
    entries = session.scalars(select(Ledger).where(Ledger.need_id == need.id)).all()
    held = sum(e.amount_minor for e in entries if e.kind == "reserve") - sum(
        e.amount_minor for e in entries if e.kind in ("release", "spend")
    )

    amount_to_spend = audit.eligible_total_minor
    if amount_to_spend > held:
        deficit = amount_to_spend - held
        available = calculate_balance(session, req.campaign_id)["available_minor"]
        if deficit > available:
            raise HTTPException(
                status_code=409,
                detail=f"Eligible spend (${amount_to_spend / 100:.2f}) exceeds available emergency pool funds (${available / 100:.2f}). Please top up the pool first.",
            )
        # Auto-reserve the difference from available pool funds
        auto_reserve = Ledger(
            campaign_id=req.campaign_id,
            need_id=need.id,
            kind="reserve",
            amount_minor=deficit,
            reference=f"auto-res-{audit.receipt_reference[:16]}-{uid()[:6]}",
        )
        session.add(auto_reserve)
        session.flush()

    # Ensure unique spend reference
    spend_ref = body.reference
    if session.scalar(select(Ledger.id).where(Ledger.reference == spend_ref)):
        spend_ref = f"{spend_ref}-{uid()[:6]}"

    # 1. Record spend event
    spend_entry = Ledger(
        campaign_id=req.campaign_id,
        need_id=need.id,
        kind="spend",
        amount_minor=amount_to_spend,
        reference=spend_ref,
    )
    session.add(spend_entry)
    session.flush()

    # 2. Attach and reconcile receipt directly
    receipt = Receipt(
        ledger_id=spend_entry.id,
        vendor=audit.vendor,
        receipt_reference=audit.receipt_reference,
        occurred_at=audit.occurred_at,
        status="reconciled",
        reconciled_by=current_member.id,
        reconciled_at=now(),
    )
    session.add(receipt)

    audit.ledger_id = spend_entry.id
    log(session, current_member, f"fulfillment.receipt_audit_applied:{body.note}", spend_entry.id)
    session.commit()

    return {
        "status": "reconciled",
        "ledger_id": spend_entry.id,
        "receipt_id": receipt.id,
        "amount_spent_minor": amount_to_spend,
    }


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


@router.get("/campaigns/{campaign_id}/receipt-audits")
def list_receipt_audits(
    campaign_id: str,
    session: Session = Depends(get_db),
    current_member: Member = Depends(actor),
):
    """Lists recent automated AI receipt audits and their verdicts."""
    require(current_member, ("admin", "finance"))
    campaign(session, campaign_id, current_member)

    audits = session.scalars(
        select(ReceiptAudit)
        .where(ReceiptAudit.campaign_id == campaign_id)
        .order_by(ReceiptAudit.created_at.desc())
        .limit(50)
    ).all()

    return [
        {
            "id": a.id,
            "vendor": a.vendor,
            "receipt_reference": a.receipt_reference,
            "total_minor": a.total_minor,
            "eligible_total_minor": a.eligible_total_minor,
            "ineligible_total_minor": a.ineligible_total_minor,
            "verdict": a.verdict,
            "occurred_at": a.occurred_at,
            "created_at": a.created_at,
        }
        for a in audits
    ]
