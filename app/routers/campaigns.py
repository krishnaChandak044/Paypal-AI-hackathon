from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import actor, campaign, log, require
from ..database import get_db
from ..ledger import calculate_balance
from ..models import AidRequest, Audit, Campaign, Job, Ledger, Member, Need
from ..schemas import CampaignIn

router = APIRouter(tags=["Campaigns & Coordination Board"])


@router.post("/campaigns")
def create_campaign(
    body: CampaignIn,
    session: Session = Depends(get_db),
    current_member: Member = Depends(actor),
):
    """Creates a new relief campaign scoped to the current organization."""
    require(current_member)

    c = Campaign(organization_id=current_member.organization_id, **body.model_dump())
    session.add(c)
    session.flush()

    log(session, current_member, "campaign.created", c.id)
    session.commit()

    return {"id": c.id}


@router.get("/campaigns")
def list_campaigns(
    session: Session = Depends(get_db),
    current_member: Member = Depends(actor),
):
    """Lists all active campaigns belonging to the organization."""
    campaigns = session.scalars(
        select(Campaign).where(Campaign.organization_id == current_member.organization_id)
    ).all()

    return [
        {"id": c.id, "name": c.name, "currency": c.currency}
        for c in campaigns
    ]


@router.get("/campaigns/{campaign_id}/pool")
def get_campaign_pool(
    campaign_id: str,
    session: Session = Depends(get_db),
    current_member: Member = Depends(actor),
):
    """Retrieves current emergency pool accounting metrics for a campaign."""
    c = campaign(session, campaign_id, current_member)
    balances = calculate_balance(session, campaign_id)
    return {"currency": c.currency, **balances}


@router.get("/campaigns/{campaign_id}/board")
def get_coordination_board(
    campaign_id: str,
    session: Session = Depends(get_db),
    current_member: Member = Depends(actor),
):
    """Returns the central commitment and gap coordination board for approved relief needs."""
    require(current_member)
    c = campaign(session, campaign_id, current_member)

    rows = []
    requests = session.scalars(
        select(AidRequest).where(AidRequest.campaign_id == campaign_id)
    ).all()

    for r in requests:
        approved_needs = session.scalars(
            select(Need).where(Need.request_id == r.id, Need.status == "approved")
        ).all()

        for n in approved_needs:
            entries = session.scalars(
                select(Ledger).where(Ledger.need_id == n.id)
            ).all()

            reserved = sum(e.amount_minor for e in entries if e.kind == "reserve") - sum(
                e.amount_minor for e in entries if e.kind in ("release", "spend")
            )
            spent = sum(e.amount_minor for e in entries if e.kind == "spend")
            unmet = max(0, n.amount_minor - reserved - spent)

            rows.append(
                {
                    "need_id": n.id,
                    "description": n.description,
                    "requested_minor": n.amount_minor,
                    "reserved_minor": reserved,
                    "spent_minor": spent,
                    "unmet_minor": unmet,
                    "is_synthetic": r.is_synthetic,
                }
            )

    return {
        "currency": c.currency,
        "pool": calculate_balance(session, campaign_id),
        "needs": rows,
    }


@router.get("/campaigns/{campaign_id}/audit")
def get_audit_trail(
    campaign_id: str,
    session: Session = Depends(get_db),
    current_member: Member = Depends(actor),
):
    """Retrieves the recent immutable audit history for the organization (Admin / Finance)."""
    require(current_member, ("admin", "finance"))
    campaign(session, campaign_id, current_member)

    events = session.scalars(
        select(Audit)
        .where(Audit.organization_id == current_member.organization_id)
        .order_by(Audit.created_at.desc())
        .limit(200)
    ).all()

    return [
        {
            "actor_id": e.actor_id,
            "action": e.action,
            "entity_id": e.entity_id,
            "created_at": e.created_at,
        }
        for e in events
    ]


@router.get("/campaigns/{campaign_id}/supporter-summary")
def get_supporter_summary(
    campaign_id: str,
    session: Session = Depends(get_db),
    current_member: Member = Depends(actor),
):
    """Returns verified aggregate pool figures for reporting, excluding recipient identifiers."""
    campaign(session, campaign_id, current_member)
    balances = calculate_balance(session, campaign_id)
    return {
        "confirmed_minor": balances["confirmed_minor"],
        "reserved_minor": balances["reserved_minor"],
        "spent_minor": balances["spent_minor"],
        "available_minor": balances["available_minor"],
    }


@router.get("/campaigns/{campaign_id}/jobs")
def get_campaign_jobs(
    campaign_id: str,
    session: Session = Depends(get_db),
    current_member: Member = Depends(actor),
):
    """Lists background processing jobs associated with this campaign (Admin only)."""
    require(current_member, ("admin",))
    campaign(session, campaign_id, current_member)

    jobs = session.scalars(
        select(Job).where(Job.entity_id == campaign_id)
    ).all()

    return [
        {
            "id": j.id,
            "kind": j.kind,
            "status": j.status,
            "attempts": j.attempts,
        }
        for j in jobs
    ]

