from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import actor, campaign, log, require
from ..database import get_db
from ..models import AidRequest, ExceptionCase, Member, Need
from ..schemas import ExceptionIn

router = APIRouter(tags=["Exceptions & Issue Tracking"])


@router.post("/campaigns/{campaign_id}/exceptions")
def add_exception(
    campaign_id: str,
    body: ExceptionIn,
    session: Session = Depends(get_db),
    current_member: Member = Depends(actor),
):
    """Registers an operational exception (e.g. price spike, shortage, delivery dispute)."""
    require(current_member)
    campaign(session, campaign_id, current_member)

    owner = session.get(Member, body.owner_id)
    if not owner or owner.organization_id != current_member.organization_id:
        raise HTTPException(status_code=400, detail="Invalid owner")

    if body.need_id:
        need = session.get(Need, body.need_id)
        if not need:
            raise HTTPException(status_code=400, detail="Invalid need")
        req = session.get(AidRequest, need.request_id)
        if not req or req.campaign_id != campaign_id:
            raise HTTPException(status_code=400, detail="Invalid need")

    exc = ExceptionCase(campaign_id=campaign_id, **body.model_dump())
    session.add(exc)
    session.flush()

    log(session, current_member, "exception.created", exc.id)
    session.commit()

    return {"id": exc.id, "status": exc.status}


@router.get("/campaigns/{campaign_id}/exceptions")
def list_exceptions(
    campaign_id: str,
    session: Session = Depends(get_db),
    current_member: Member = Depends(actor),
):
    """Lists all active and historical operational exceptions for a campaign."""
    require(current_member)
    campaign(session, campaign_id, current_member)

    exceptions = session.scalars(
        select(ExceptionCase).where(ExceptionCase.campaign_id == campaign_id)
    ).all()

    return [
        {
            "id": e.id,
            "need_id": e.need_id,
            "reason": e.reason,
            "owner_id": e.owner_id,
            "status": e.status,
        }
        for e in exceptions
    ]

