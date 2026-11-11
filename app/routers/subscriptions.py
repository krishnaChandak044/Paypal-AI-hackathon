"""PayPal subscription setup; balances change only from verified sale webhooks."""
import os

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import actor, campaign, log, require
from ..database import get_db, now, uid
from ..models import Member, Subscription
from ..payments import PAYPAL_BASE_URL, get_access_token
from ..predictive_buffer import calculate_community_resilience_buffer
from ..schemas import CommunityResilienceBufferOut, CreateSubscriptionIn, SubscriptionOut

router = APIRouter(tags=["PayPal Subscriptions & Resilience Buffer"])

PLAN_ENV = {
    "Community Guardian": "PAYPAL_PLAN_COMMUNITY_GUARDIAN",
    "Resilience Sentinel": "PAYPAL_PLAN_RESILIENCE_SENTINEL",
    "Pool Anchor": "PAYPAL_PLAN_POOL_ANCHOR",
}
TIER_AMOUNTS = {"Community Guardian": 1000, "Resilience Sentinel": 2500, "Pool Anchor": 5000}


@router.post("/campaigns/{campaign_id}/subscriptions/create", response_model=SubscriptionOut, status_code=201)
async def create_community_subscription(
    campaign_id: str,
    body: CreateSubscriptionIn,
    session: Session = Depends(get_db),
    current_member: Member = Depends(actor),
):
    c = campaign(session, campaign_id, current_member)
    require(current_member, ("admin", "organizer", "finance"))

    expected_amount = TIER_AMOUNTS.get(body.tier_name)
    plan_id = os.getenv(PLAN_ENV.get(body.tier_name, "")) if body.tier_name in PLAN_ENV else None
    if expected_amount is None or body.amount_minor != expected_amount:
        raise HTTPException(status_code=422, detail="Choose a supported fixed monthly tier")
    if not plan_id:
        raise HTTPException(status_code=503, detail="A matching active PayPal monthly plan is not configured")
    if os.getenv("PAYPAL_ENVIRONMENT", "sandbox") != "sandbox":
        raise HTTPException(status_code=503, detail="Only PayPal sandbox subscriptions are enabled")

    async with httpx.AsyncClient(timeout=20) as client:
        token = await get_access_token(client)
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        plan_res = await client.get(f"{PAYPAL_BASE_URL}/v1/billing/plans/{plan_id}", headers=headers)
        if not plan_res.is_success:
            raise HTTPException(status_code=503, detail="Configured PayPal plan could not be verified")
        plan = plan_res.json()
        regular = [x for x in plan.get("billing_cycles", []) if x.get("tenure_type") == "REGULAR"]
        if (
            plan.get("status") != "ACTIVE"
            or len(regular) != 1
            or (regular[0].get("frequency") or {}).get("interval_unit") != "MONTH"
            or (regular[0].get("frequency") or {}).get("interval_count") != 1
            or (regular[0].get("pricing_scheme") or {}).get("fixed_price", {}).get("currency_code") != c.currency
            or (regular[0].get("pricing_scheme") or {}).get("fixed_price", {}).get("value") != f"{expected_amount / 100:.2f}"
        ):
            raise HTTPException(status_code=503, detail="PayPal plan must be active and match the selected monthly tier and campaign currency")

        names = body.subscriber_name.strip().split(maxsplit=1)
        payload = {
            "plan_id": plan_id,
            "subscriber": {
                "name": {"given_name": names[0], "surname": names[1] if len(names) > 1 else names[0]},
                "email_address": body.subscriber_email,
            },
            "custom_id": campaign_id,
            "application_context": {"brand_name": "ReliefRail", "user_action": "SUBSCRIBE_NOW"},
        }
        response = await client.post(f"{PAYPAL_BASE_URL}/v1/billing/subscriptions", headers=headers, json=payload)
        if response.status_code != 201:
            raise HTTPException(status_code=502, detail="PayPal could not create the subscription approval")
        data = response.json()
        subscription_id = data.get("id")
        approval_url = next((x.get("href") for x in data.get("links", []) if x.get("rel") == "approve"), None)
        if not subscription_id or not approval_url:
            raise HTTPException(status_code=502, detail="PayPal response did not include a subscription ID and approval link")

    sub = Subscription(
        id=uid(), campaign_id=campaign_id, subscription_id=subscription_id, plan_id=plan_id,
        subscriber_email=body.subscriber_email, subscriber_name=body.subscriber_name,
        tier_name=body.tier_name, amount_minor=expected_amount, currency=c.currency,
        status="APPROVAL_PENDING", interval_unit="MONTH", created_at=now(),
    )
    session.add(sub)
    log(session, current_member, "subscription.approval_created", sub.id)
    session.commit()
    return SubscriptionOut(
        subscription_id=subscription_id, plan_id=plan_id, status=sub.status,
        tier_name=sub.tier_name, amount_minor=sub.amount_minor, currency=c.currency,
        approval_url=approval_url,
        message="PayPal created the subscription. It is not active or counted until the buyer approves and PayPal confirms activation.",
    )


@router.get("/campaigns/{campaign_id}/subscriptions/buffer", response_model=CommunityResilienceBufferOut)
def get_resilience_buffer(
    campaign_id: str,
    session: Session = Depends(get_db),
    current_member: Member = Depends(actor),
):
    require(current_member)
    campaign(session, campaign_id, current_member)
    return calculate_community_resilience_buffer(session, campaign_id)
