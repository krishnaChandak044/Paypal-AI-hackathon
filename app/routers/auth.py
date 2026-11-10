import hashlib
import hmac
import os
import uuid

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import actor, log, require
from ..database import engine, get_db
from ..models import Member, Organization
from ..schemas import MemberIn, OrgIn

router = APIRouter(tags=["Authentication & Organization"])


@router.post("/bootstrap")
def bootstrap(
    body: OrgIn,
    x_bootstrap_secret: str = Header(default=""),
    session: Session = Depends(get_db),
):
    """Initializes the organization and creates the first administrator account.

    Protected by the BOOTSTRAP_SECRET environment variable. Can only be executed once.
    """
    secret = os.getenv("BOOTSTRAP_SECRET")
    if not secret or not hmac.compare_digest(x_bootstrap_secret, secret):
        raise HTTPException(status_code=403, detail="Bootstrap disabled or unauthorized")

    if engine.dialect.name == "sqlite":
        session.connection().exec_driver_sql("BEGIN IMMEDIATE")

    existing_org = session.scalar(select(Organization.id).limit(1))
    if existing_org:
        raise HTTPException(status_code=409, detail="Already bootstrapped")

    token = uuid.uuid4().hex + uuid.uuid4().hex
    org = Organization(name=body.name)
    session.add(org)
    session.flush()

    admin = Member(
        organization_id=org.id,
        name=body.admin_name,
        role="admin",
        token_hash=hashlib.sha256(token.encode()).hexdigest(),
    )
    session.add(admin)
    session.commit()

    return {
        "organization_id": org.id,
        "admin_id": admin.id,
        "admin_token": token,
    }


@router.post("/members")
def create_member(
    body: MemberIn,
    session: Session = Depends(get_db),
    current_member: Member = Depends(actor),
):
    """Creates a new team member with a designated role (Admin only)."""
    require(current_member, ("admin",))

    token = uuid.uuid4().hex + uuid.uuid4().hex
    member = Member(
        organization_id=current_member.organization_id,
        token_hash=hashlib.sha256(token.encode()).hexdigest(),
        **body.model_dump(),
    )
    session.add(member)
    session.flush()

    log(session, current_member, "member.created", member.id)
    session.commit()

    return {"id": member.id, "token": token}


@router.post("/members/{member_id}/rotate-token")
def rotate_token(
    member_id: str,
    session: Session = Depends(get_db),
    current_member: Member = Depends(actor),
):
    """Rotates a member's bearer token. Members may rotate their own, or an admin may rotate any."""
    if current_member.id != member_id:
        require(current_member, ("admin",))

    target = session.get(Member, member_id)
    if not target or target.organization_id != current_member.organization_id:
        raise HTTPException(status_code=404, detail="Member not found")

    new_token = uuid.uuid4().hex + uuid.uuid4().hex
    target.token_hash = hashlib.sha256(new_token.encode()).hexdigest()

    log(session, current_member, "member.token_rotated", target.id)
    session.commit()

    return {"token": new_token}


@router.post("/members/{member_id}/revoke")
def revoke_member(
    member_id: str,
    session: Session = Depends(get_db),
    current_member: Member = Depends(actor),
):
    """Revokes a member's access token (Admin only). Cannot revoke own account."""
    require(current_member, ("admin",))
    if current_member.id == member_id:
        raise HTTPException(status_code=409, detail="Cannot revoke own account")

    target = session.get(Member, member_id)
    if not target or target.organization_id != current_member.organization_id:
        raise HTTPException(status_code=404, detail="Member not found")

    target.token_hash = hashlib.sha256(uuid.uuid4().bytes).hexdigest()
    log(session, current_member, "member.revoked", target.id)
    session.commit()

    return {"status": "revoked"}

