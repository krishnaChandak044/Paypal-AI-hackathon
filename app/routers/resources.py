from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import actor, campaign, log, require
from ..database import get_db
from ..models import Member, Resource
from ..schemas import ResourceIn

router = APIRouter(tags=["Resources & In-Kind Inventory"])


@router.post("/campaigns/{campaign_id}/resources")
def add_resource(
    campaign_id: str,
    body: ResourceIn,
    session: Session = Depends(get_db),
    current_member: Member = Depends(actor),
):
    """Records an available in-kind supply, volunteer capacity, or local provider option."""
    require(current_member)
    campaign(session, campaign_id, current_member)

    res = Resource(campaign_id=campaign_id, **body.model_dump())
    session.add(res)
    session.flush()

    log(session, current_member, "resource.created", res.id)
    session.commit()

    return {"id": res.id}


@router.get("/campaigns/{campaign_id}/resources")
def list_resources(
    campaign_id: str,
    session: Session = Depends(get_db),
    current_member: Member = Depends(actor),
):
    """Lists all registered resource and inventory records for a campaign."""
    require(current_member)
    campaign(session, campaign_id, current_member)

    resources = session.scalars(
        select(Resource).where(Resource.campaign_id == campaign_id)
    ).all()

    return [
        {
            "id": r.id,
            "description": r.description,
            "quantity": r.quantity,
            "source": r.source,
            "confirmed_at": r.confirmed_at,
        }
        for r in resources
    ]

