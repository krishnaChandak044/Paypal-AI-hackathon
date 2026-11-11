import json
import os

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import actor, campaign, log, require
from ..database import get_db, now, uid
from ..dedup import detect_duplicates_for_request, merge_duplicate_requests
from ..models import AidRequest, Member, Need, RecipientAccess, RequestRevision
from ..schemas import (
    MergeRequestIn,
    MergeRequestOut,
    NeedIn,
    RequestDuplicatesOut,
    RequestIn,
    SimulateDuplicateIn,
    StatusIn,
)

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
        {"id": r.id, "message": r.message, "status": r.status, "created_at": r.created_at, "is_synthetic": r.is_synthetic}
        for r in requests
    ]


@router.get("/campaigns/{campaign_id}/requests/{request_id}/duplicates", response_model=RequestDuplicatesOut)
def get_request_duplicates(
    campaign_id: str,
    request_id: str,
    session: Session = Depends(get_db),
    current_member: Member = Depends(actor),
):
    """Return deterministic text/address similarity signals for coordinator review."""
    require(current_member)
    campaign(session, campaign_id, current_member)

    return detect_duplicates_for_request(session, campaign_id, request_id)


@router.get("/campaigns/{campaign_id}/requests/radar/summary")
def get_campaign_radar_summary(
    campaign_id: str,
    session: Session = Depends(get_db),
    current_member: Member = Depends(actor),
):
    """Fast summary of detected duplicates across all active requests for triage indicators."""
    require(current_member)
    campaign(session, campaign_id, current_member)

    requests = session.scalars(
        select(AidRequest).where(
            AidRequest.campaign_id == campaign_id,
            AidRequest.status != "merged",
        )
    ).all()

    summary = {}
    for r in requests:
        res = detect_duplicates_for_request(session, campaign_id, r.id, threshold=0.70)
        if res.matches:
            top = res.matches[0]
            summary[r.id] = {
                "has_duplicate": True,
                "similarity_score": top.similarity_score,
                "similarity_percentage": top.similarity_percentage,
                "matched_request_id": top.matched_request_id,
                "reason": top.reason,
                "potential_savings_minor": top.potential_savings_minor,
            }
        else:
            summary[r.id] = {
                "has_duplicate": False,
                "similarity_score": 0.0,
                "similarity_percentage": 0,
                "matched_request_id": None,
                "reason": "",
                "potential_savings_minor": 0,
            }

    return summary


@router.post("/campaigns/{campaign_id}/requests/merge", response_model=MergeRequestOut)
def merge_requests_endpoint(
    campaign_id: str,
    body: MergeRequestIn,
    session: Session = Depends(get_db),
    current_member: Member = Depends(actor),
):
    """Accountable 1-click merge of a duplicate request into a primary request to prevent double payout."""
    require(current_member)
    campaign(session, campaign_id, current_member)

    try:
        return merge_duplicate_requests(
            session=session,
            current_member=current_member,
            campaign_id=campaign_id,
            primary_request_id=body.primary_request_id,
            duplicate_request_id=body.duplicate_request_id,
            reason_note=body.reason,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/campaigns/{campaign_id}/requests/simulate-duplicate")
def simulate_duplicate_request(
    campaign_id: str,
    body: SimulateDuplicateIn,
    session: Session = Depends(get_db),
    current_member: Member = Depends(actor),
):
    """Adds or reuses a fictional request pair to demonstrate similarity review."""
    require(current_member)
    c = campaign(session, campaign_id, current_member)

    # Use a wholly fictional synthetic pair; neither request is pre-approved and
    # no estimated duplicate exposure is recorded as a real dollar saving.
    existing_primary = session.scalars(
        select(AidRequest).where(
            AidRequest.campaign_id == campaign_id,
            AidRequest.message == "Synthetic case: A household at the fictional address 104 Riverside Drive reports flood damage and asks for a portable generator for medical equipment.",
            AidRequest.status != "merged",
            AidRequest.is_synthetic.is_(True),
        )
    ).first()

    if not existing_primary:
        primary_req = AidRequest(
            id=uid(),
            campaign_id=campaign_id,
            message="Synthetic case: A household at the fictional address 104 Riverside Drive reports flood damage and asks for a portable generator for medical equipment.",
            status="received",
            is_synthetic=True,
            created_at=now(),
        )
        session.add(primary_req)
        session.flush()

        primary_id = primary_req.id
    else:
        primary_id = existing_primary.id

    duplicate_message = "Synthetic duplicate: A relative reports a household at fictional 104 Riverside Drive has flood damage and asks for a generator for medical equipment."
    dup_req = session.scalar(
        select(AidRequest).where(
            AidRequest.campaign_id == campaign_id,
            AidRequest.message == duplicate_message,
            AidRequest.is_synthetic.is_(True),
            AidRequest.status != "merged",
        ).limit(1)
    )
    reused = dup_req is not None
    if not dup_req:
        dup_req = AidRequest(
            id=uid(), campaign_id=campaign_id, message=duplicate_message,
            status="received", is_synthetic=True, created_at=now(),
        )
        session.add(dup_req)
        session.flush()

    log(session, current_member, "simulation.duplicate_injected", dup_req.id)
    session.commit()

    return {
        "status": "duplicate_simulated",
        "primary_request_id": primary_id,
        "duplicate_request_id": dup_req.id,
        "duplicate_message": dup_req.message,
        "potential_savings_minor": 0,
        "reused": reused,
    }



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

    if not req.is_synthetic:
        raise HTTPException(
            status_code=403,
            detail="External AI drafting is limited to explicitly synthetic demo requests.",
        )

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

