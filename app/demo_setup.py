"""Prepare an explicitly synthetic local showcase workspace (no fake funds or approvals)."""
import argparse
import hashlib
import json
import os
import secrets

from sqlalchemy import select

from .database import SessionLocal, uid
from .models import AidRequest, Campaign, Member, Organization

DEMO_ORGANIZATION = "ReliefRail Demo Organization"
DEMO_CAMPAIGN = "ReliefRail Demo — Riverbend Flood Response"
DEMO_OPERATOR = "ReliefRail Demo Operator"
DEMO_REQUESTS = (
    "Synthetic case: A senior household in a fictional riverside zone reports a flooded ground floor and asks for backup power for essential medical equipment.",
    "Synthetic case: A displaced family at a fictional school shelter asks for infant formula, diapers, and warm bedding.",
    "Synthetic case: A volunteer crew at a fictional creek crossing asks for a replacement water pump and safety waders.",
)


def prepare_demo() -> dict[str, str | int]:
    """Idempotently create a demo campaign, synthetic cases, and a one-time admin token."""
    if not os.getenv("BOOTSTRAP_SECRET"):
        raise RuntimeError("Set BOOTSTRAP_SECRET in .env before preparing the demo")

    with SessionLocal() as session:
        organization = session.scalar(
            select(Organization).where(Organization.name == DEMO_ORGANIZATION).limit(1)
        )
        if not organization:
            organization = Organization(id=uid(), name=DEMO_ORGANIZATION)
            session.add(organization)
            session.flush()

        campaign = session.scalar(
            select(Campaign).where(
                Campaign.organization_id == organization.id,
                Campaign.name == DEMO_CAMPAIGN,
            ).limit(1)
        )
        if not campaign:
            campaign = Campaign(
                id=uid(), organization_id=organization.id, name=DEMO_CAMPAIGN, currency="USD"
            )
            session.add(campaign)
            session.flush()

        operator = session.scalar(
            select(Member).where(
                Member.organization_id == organization.id,
                Member.name == DEMO_OPERATOR,
            ).limit(1)
        )
        token = secrets.token_urlsafe(36)
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        if operator:
            operator.role = "admin"
            operator.token_hash = token_hash
        else:
            operator = Member(
                id=uid(), organization_id=organization.id, name=DEMO_OPERATOR,
                role="admin", token_hash=token_hash,
            )
            session.add(operator)

        created = 0
        for message in DEMO_REQUESTS:
            existing = session.scalar(
                select(AidRequest.id).where(
                    AidRequest.campaign_id == campaign.id,
                    AidRequest.is_synthetic.is_(True),
                    AidRequest.message == message,
                ).limit(1)
            )
            if existing:
                continue
            session.add(AidRequest(
                id=uid(), campaign_id=campaign.id, message=message,
                status="received", is_synthetic=True,
            ))
            created += 1

        session.commit()
        return {
            "campaign_id": campaign.id,
            "campaign_name": campaign.name,
            "synthetic_requests_added": created,
            "admin_token": token,
        }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--confirm", action="store_true", help="Confirm local demo operator setup")
    args = parser.parse_args()
    if not args.confirm:
        parser.error("Pass --confirm to create/rotate the local demo admin token")
    print(json.dumps(prepare_demo()))
