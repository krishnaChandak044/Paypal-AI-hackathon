"""Contract tests for truthful subscription, payout, and synthetic-map behavior."""

import asyncio

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.database import Base, uid
from app.geo_clusters import get_geographic_need_clusters
from app.ledger import calculate_balance
from app.models import AidRequest, Campaign, Ledger, Need, Organization, Payout, Subscription
from app.payouts import apply_payout_status, map_payout_status
from app.predictive_buffer import calculate_community_resilience_buffer
from app.routers.paypal import get_paypal_order_journey


def test_payout_is_success_only_when_batch_and_item_succeed():
    assert map_payout_status("SUCCESS", "SUCCESS") == "SUCCESS"
    assert map_payout_status("SUCCESS", "PENDING") == "PENDING"
    assert map_payout_status("PROCESSING", "SUCCESS") == "PENDING"
    assert map_payout_status("DENIED", "SUCCESS") == "FAILED"
    assert map_payout_status("SUCCESS", "FAILED") == "FAILED"


def test_approval_pending_subscription_is_not_counted_or_seeded():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        organization = Organization(id=uid(), name="Test organization")
        session.add(organization)
        session.flush()
        campaign = Campaign(id=uid(), organization_id=organization.id, name="Test", currency="USD")
        session.add(campaign)
        session.flush()
        session.add(Subscription(
            id=uid(), campaign_id=campaign.id, subscription_id="I-TEST", plan_id="P-TEST",
            subscriber_email="test@example.invalid", subscriber_name="Test", tier_name="Resilience Sentinel",
            amount_minor=2500, currency="USD", status="APPROVAL_PENDING", interval_unit="MONTH",
        ))
        session.commit()

        buffer = calculate_community_resilience_buffer(session, campaign.id)
        assert buffer["total_active_guardians"] == 0
        assert buffer["monthly_runrate_minor"] == 0
        assert len(session.scalars(select(Subscription)).all()) == 1
    engine.dispose()


def test_confirmed_payout_is_idempotent_and_failure_releases_reserve():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        organization = Organization(id=uid(), name="Test organization")
        session.add(organization)
        session.flush()
        campaign = Campaign(id=uid(), organization_id=organization.id, name="Test", currency="USD")
        session.add(campaign)
        session.flush()
        request = AidRequest(id=uid(), campaign_id=campaign.id, message="Synthetic test", status="approved")
        session.add(request)
        session.flush()
        need = Need(id=uid(), request_id=request.id, description="Test supplies", amount_minor=1000, status="approved")
        session.add(need)
        contribution = Ledger(campaign_id=campaign.id, kind="contribution", amount_minor=1000, reference="test:contribution")
        hold = Ledger(campaign_id=campaign.id, need_id=need.id, kind="reserve", amount_minor=600, reference="test:hold")
        session.add_all([contribution, hold])
        session.flush()
        payout = Payout(
            id=uid(), campaign_id=campaign.id, need_id=need.id, ledger_id=hold.id,
            payout_batch_id="BATCH-TEST", sender_batch_id="SENDER-TEST", sender_item_id="ITEM-TEST",
            recipient_email="test@example.invalid", recipient_name="Test", recipient_type="volunteer_lead",
            amount_minor=600, fee_minor=0, currency="USD", status="PENDING", mode="paypal_sandbox",
            purpose_note="Synthetic test payout",
        )
        session.add(payout)
        session.commit()

        apply_payout_status(session, payout, "SUCCESS")
        session.commit()
        apply_payout_status(session, payout, "SUCCESS")
        session.commit()
        assert payout.status == "SUCCESS"
        assert calculate_balance(session, campaign.id) == {
            "confirmed_minor": 1000, "reserved_minor": 0, "spent_minor": 600, "available_minor": 400,
        }
        assert len(session.scalars(select(Ledger).where(Ledger.reference == f"paypal:payout:spend:{payout.id}")).all()) == 1

        failed_hold = Ledger(campaign_id=campaign.id, need_id=need.id, kind="reserve", amount_minor=200, reference="test:failed-hold")
        session.add(failed_hold)
        session.flush()
        failed_payout = Payout(
            id=uid(), campaign_id=campaign.id, need_id=need.id, ledger_id=failed_hold.id,
            payout_batch_id="BATCH-FAILED", sender_batch_id="SENDER-FAILED", sender_item_id="ITEM-FAILED",
            recipient_email="test@example.invalid", recipient_name="Test", recipient_type="volunteer_lead",
            amount_minor=200, fee_minor=0, currency="USD", status="PENDING", mode="paypal_sandbox",
            purpose_note="Synthetic test payout",
        )
        session.add(failed_payout)
        session.commit()
        apply_payout_status(session, failed_payout, "FAILED")
        session.commit()
        balance = calculate_balance(session, campaign.id)
        assert failed_payout.status == "FAILED"
        assert balance["reserved_minor"] == 0
        assert balance["available_minor"] == 400
    engine.dispose()


def test_unknown_public_journey_order_returns_404():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        with pytest.raises(HTTPException) as exc:
            asyncio.run(get_paypal_order_journey("unknown-order-id", session))
        assert exc.value.status_code == 404
    engine.dispose()


def test_geo_map_is_explicitly_synthetic_and_has_no_privacy_certification():
    data = get_geographic_need_clusters(None, "fictional-campaign")
    assert data["data_source"] == "synthetic_demo"
    assert "not a privacy certification" in data["privacy_note"]
    assert len(data["clusters"]) == 5
    assert all(cluster["status"].startswith("illustrative_") for cluster in data["clusters"])
    assert all("zero_pii_hash" not in cluster for cluster in data["clusters"])
