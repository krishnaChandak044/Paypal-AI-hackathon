import hashlib
import hmac
from typing import Sequence

from fastapi import Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .database import get_db
from .models import AidRequest, Audit, Campaign, Member, RecipientAccess


def actor(
    authorization: str = Header(default=""),
    session: Session = Depends(get_db),
) -> Member:
    """Authenticates an organization member using a Bearer token hash."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Bearer token required")

    token = authorization[7:].strip()
    digest = hashlib.sha256(token.encode()).hexdigest()
    member = session.scalar(select(Member).where(Member.token_hash == digest))
    if not member:
        raise HTTPException(status_code=401, detail="Invalid token")
    return member


def require(
    member: Member,
    roles: Sequence[str] = ("admin", "organizer", "finance"),
) -> None:
    """Enforces role-based authorization for organization members."""
    if member.role not in roles:
        raise HTTPException(status_code=403, detail="Insufficient role")


def campaign(
    session: Session,
    campaign_id: str,
    member: Member,
) -> Campaign:
    """Verifies that a campaign exists and belongs to the member's organization."""
    c = session.get(Campaign, campaign_id)
    if not c or c.organization_id != member.organization_id:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return c


def log(
    session: Session,
    member: Member,
    action: str,
    entity_id: str,
) -> None:
    """Appends an immutable audit log entry."""
    session.add(
        Audit(
            organization_id=member.organization_id,
            actor_id=member.id,
            action=action,
            entity_id=entity_id,
        )
    )


def recipient(
    session: Session,
    request_id: str,
    authorization: str,
) -> AidRequest:
    """Authenticates a recipient's direct access to their aid request."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Bearer token required")

    token = authorization[7:].strip()
    token_digest = hashlib.sha256(token.encode()).hexdigest()

    access = session.scalar(
        select(RecipientAccess).where(RecipientAccess.request_id == request_id)
    )
    if not access or not hmac.compare_digest(access.token_hash, token_digest):
        raise HTTPException(status_code=404, detail="Request not found")

    req = session.get(AidRequest, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    return req

