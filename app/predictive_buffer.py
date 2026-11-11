"""Conservative, assumption-labelled community buffer projections."""
from typing import Any, Dict

from sqlalchemy import select
from sqlalchemy.orm import Session

from .ledger import calculate_balance
from .models import Subscription


AVERAGE_AID_PACK_MINOR = 7500
ASSUMED_DAILY_BURN_MINOR = 2800
TARGET_RUNWAY_DAYS = 30


def calculate_community_resilience_buffer(session: Session, campaign_id: str) -> Dict[str, Any]:
    """Read-only metrics; only provider-confirmed active subscriptions are projected."""
    subscriptions = session.scalars(
        select(Subscription).where(
            Subscription.campaign_id == campaign_id,
            Subscription.status == "ACTIVE",
        )
    ).all()

    guardian_count = len(subscriptions)
    monthly_runrate_minor = sum(s.amount_minor for s in subscriptions)
    annual_projected_minor = monthly_runrate_minor * 12
    pool = calculate_balance(session, campaign_id)
    runway_days = round(pool["available_minor"] / ASSUMED_DAILY_BURN_MINOR, 1)
    estimated_packs = pool["available_minor"] // AVERAGE_AID_PACK_MINOR
    score = min(100, round(runway_days * 100 / TARGET_RUNWAY_DAYS))
    rating = "Strong buffer" if score >= 80 else "Building buffer" if score >= 30 else "Limited buffer"

    tiers = {
        "community_guardian": sum(1 for s in subscriptions if s.tier_name == "Community Guardian"),
        "resilience_sentinel": sum(1 for s in subscriptions if s.tier_name == "Resilience Sentinel"),
        "pool_anchor": sum(1 for s in subscriptions if s.tier_name == "Pool Anchor"),
        "custom": sum(1 for s in subscriptions if s.tier_name == "Custom"),
    }
    return {
        "campaign_id": campaign_id,
        "total_active_guardians": guardian_count,
        "monthly_runrate_minor": monthly_runrate_minor,
        "monthly_runrate_formatted": f"${monthly_runrate_minor / 100:,.2f}",
        "annual_projected_minor": annual_projected_minor,
        "households_protected": estimated_packs,
        "autonomous_runway_days": runway_days,
        "resilience_score": score,
        "resilience_rating": rating,
        "ai_predictive_statement": (
            f"The confirmed pool currently covers about {runway_days} days at the illustrative "
            f"${ASSUMED_DAILY_BURN_MINOR / 100:.2f}/day burn assumption."
        ),
        "estimation_note": (
            "Monthly and annual subscription amounts are projections, not available cash. "
            f"Runway uses the current available ledger balance and an assumed ${ASSUMED_DAILY_BURN_MINOR / 100:.2f}/day burn; "
            f"aid-pack count assumes ${AVERAGE_AID_PACK_MINOR / 100:.2f} per pack. These are planning estimates, not guarantees."
        ),
        "tier_breakdown": tiers,
        # Avoid exposing supporter names, emails, PayPal IDs, or a recent-donor feed.
        "recent_guardians": [],
    }
