import json
import os

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import actor, campaign, log, require
from ..database import get_db
from ..models import AidRequest, Member, Need, RecipientAccess, RequestRevision
from ..schemas import NeedIn, RequestIn, StatusIn

router = APIRouter(tags=["Requests & Aid Plans"])


@router.post("/campaigns/{campaign_id}/requests")
def create_request(
    campaign_id: str,
    body: RequestIn,
    session: Session = Depends(get_db),
    current_member: Member = Depends(actor),
):
    """Records an incoming aid request for an active campaign."""
    require(current_member)
    campaign(session, campaign_id, current_member)

    req = AidRequest(campaign_id=campaign_id, message=body.message)
    session.add(req)
    session.flush()

    log(session, current_member, "request.created", req.id)
    session.commit()

    return {"id": req.id, "status": req.status}


@router.get("/campaigns/{campaign_id}/requests")
def list_requests(
    campaign_id: str,
    session: Session = Depends(get_db),
    current_member: Member = Depends(actor),
):
    """Lists all aid requests received for a campaign."""
    require(current_member)
    campaign(session, campaign_id, current_member)

    requests = session.scalars(
        select(AidRequest).where(AidRequest.campaign_id == campaign_id)
    ).all()

    return [
        {"id": r.id, "message": r.message, "status": r.status}
        for r in requests
    ]


@router.post("/requests/{request_id}/needs")
def create_need(
    request_id: str,
    body: NeedIn,
    session: Session = Depends(get_db),
    current_member: Member = Depends(actor),
):
    """Attaches a structured need item to an aid request in draft state."""
    require(current_member)

    req = session.get(AidRequest, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    campaign(session, req.campaign_id, current_member)

    need = Need(request_id=request_id, **body.model_dump())
    session.add(need)
    session.flush()

    log(session, current_member, "need.created", need.id)
    session.commit()

    return {"id": need.id, "status": need.status}


@router.post("/needs/{need_id}/approve")
def approve_need(
    need_id: str,
    session: Session = Depends(get_db),
    current_member: Member = Depends(actor),
):
    """Human approval of a structured need item, advancing request to approved state."""
    require(current_member)

    need = session.get(Need, need_id)
    if not need:
        raise HTTPException(status_code=404, detail="Need not found")

    req = session.get(AidRequest, need.request_id)
    campaign(session, req.campaign_id, current_member)

    if need.status != "draft":
        raise HTTPException(status_code=409, detail="Need is not a draft")

    need.status = "approved"
    req.status = "approved"

    log(session, current_member, "need.approved", need.id)
    session.commit()

    return {"status": need.status}


@router.post("/requests/{request_id}/status")
def change_request_status(
    request_id: str,
    body: StatusIn,
    session: Session = Depends(get_db),
    current_member: Member = Depends(actor),
):
    """Updates the operational status of an aid request with an accountable reason."""
    require(current_member)

    req = session.get(AidRequest, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    campaign(session, req.campaign_id, current_member)
    req.status = body.status

    log(session, current_member, f"request.status:{body.status}", req.id)
    session.commit()

    return {"status": req.status}


@router.post("/requests/{request_id}/redact")
def redact_request(
    request_id: str,
    session: Session = Depends(get_db),
    current_member: Member = Depends(actor),
):
    """Redacts all narrative content and revokes recipient tokens (Admin only)."""
    require(current_member, ("admin",))

    req = session.get(AidRequest, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    campaign(session, req.campaign_id, current_member)

    req.message = "[redacted]"
    revisions = session.scalars(
        select(RequestRevision).where(RequestRevision.request_id == request_id)
    ).all()
    for rev in revisions:
        rev.message = "[redacted]"

    access = session.scalar(
        select(RecipientAccess).where(RecipientAccess.request_id == request_id)
    )
    if access:
        session.delete(access)

    log(session, current_member, "request.redacted", req.id)
    session.commit()

    return {"status": "redacted"}


@router.post("/requests/{request_id}/ai-draft")
async def ai_draft(
    request_id: str,
    session: Session = Depends(get_db),
    current_member: Member = Depends(actor),
):
    """Drafts proposed structured needs and clarifying questions from raw narrative text.

    AI proposals are non-authoritative drafts and require explicit human review and approval.
    """
    require(current_member)

    req = session.get(AidRequest, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    campaign(session, req.campaign_id, current_member)

    api_key = os.getenv("META_MODEL_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="Meta API key missing")

    if os.getenv("ALLOW_SYNTHETIC_AI", "").lower() != "true":
        raise HTTPException(status_code=403, detail="AI draft requires synthetic demo mode")

    payload = {
        "model": os.getenv("AI_MODEL", "muse-spark-1.3"),
        "messages": [
            {
                "role": "system",
                "content": (
                    'You draft relief needs for human review. Return JSON only: '
                    '{"needs":[{"description":"...","amount_minor":0}],"questions":["..."],"uncertainties":["..."]}. '
                    "Never approve eligibility or payment. Amounts are estimates."
                ),
            },
            {"role": "user", "content": req.message},
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
            content = response.json()["choices"][0]["message"]["content"]
            result = json.loads(content)
            if not isinstance(result.get("needs"), list):
                raise ValueError("Malformed draft response from AI provider")
            return {"draft": result, "status": "unapproved"}
    except (httpx.HTTPError, KeyError, ValueError, TypeError) as exc:
        raise HTTPException(status_code=502, detail="AI draft unavailable or invalid") from exc

