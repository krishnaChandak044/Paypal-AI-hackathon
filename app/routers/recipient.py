import hashlib
import os
import uuid

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import recipient
from ..database import engine, get_db
from ..limits import limit
from ..models import AidRequest, Campaign, Need, RecipientAccess, RequestRevision
from ..schemas import RecipientRequestIn

router = APIRouter(tags=["Recipient Self-Service Portal"])


@router.post("/campaigns/{campaign_id}/recipient-intake")
def public_recipient_intake(
    campaign_id: str,
    body: RecipientRequestIn,
    request: Request,
    session: Session = Depends(get_db),
):
    """Public aid intake for recipients (opt-in; protected by per-IP rate limits)."""
    if os.getenv("ENABLE_PUBLIC_INTAKE", "false").lower() != "true":
        raise HTTPException(status_code=403, detail="Public intake disabled")

    campaign_obj = session.get(Campaign, campaign_id)
    if not campaign_obj:
        raise HTTPException(status_code=404, detail="Campaign not found")

    if engine.dialect.name == "sqlite":
        session.connection().exec_driver_sql("BEGIN IMMEDIATE")

    limit(request, session, "intake", max_count=5, seconds=3600)

    token = uuid.uuid4().hex + uuid.uuid4().hex
    req = AidRequest(campaign_id=campaign_id, message=body.message)
    session.add(req)
    session.flush()

    session.add(
        RecipientAccess(
            request_id=req.id,
            token_hash=hashlib.sha256(token.encode()).hexdigest(),
        )
    )
    session.add(
        RequestRevision(
            request_id=req.id,
            actor_id="recipient",
            message=body.message,
        )
    )
    session.commit()

    return {
        "request_id": req.id,
        "access_token": token,
        "status": req.status,
    }


@router.get("/recipient/requests/{request_id}")
def check_request_status(
    request_id: str,
    authorization: str = Header(default=""),
    session: Session = Depends(get_db),
):
    """Allows a recipient to check the status of their request using their access token."""
    req = recipient(session, request_id, authorization)
    return {
        "id": req.id,
        "status": req.status,
        "created_at": req.created_at,
    }


@router.post("/recipient/requests/{request_id}/clarify")
def clarify_request(
    request_id: str,
    body: RecipientRequestIn,
    authorization: str = Header(default=""),
    session: Session = Depends(get_db),
):
    """Submits an updated narrative or answers clarifying questions from the organization."""
    req = recipient(session, request_id, authorization)
    if req.status in ("declined", "withdrawn"):
        raise HTTPException(status_code=409, detail="Request closed")

    session.add(
        RequestRevision(
            request_id=request_id,
            actor_id="recipient",
            message=body.message,
        )
    )
    req.message = body.message
    req.status = "received"
    session.commit()

    return {"status": req.status}


@router.post("/recipient/requests/{request_id}/withdraw")
def withdraw_request(
    request_id: str,
    authorization: str = Header(default=""),
    session: Session = Depends(get_db),
):
    """Allows a recipient to withdraw an unapproved request."""
    req = recipient(session, request_id, authorization)
    if req.status == "withdrawn":
        return {"status": "withdrawn"}

    approved_need = session.scalar(
        select(Need.id).where(Need.request_id == request_id, Need.status == "approved")
    )
    if approved_need:
        raise HTTPException(
            status_code=409,
            detail="Contact organization to withdraw an approved request",
        )

    req.status = "withdrawn"
    session.commit()

    return {"status": req.status}

