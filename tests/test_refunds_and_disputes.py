import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.database import Base, uid
from app.ledger import calculate_balance
from app.models import Campaign, Ledger, Organization, Payment, PaymentDispute, ProviderRefund
from app.payments import amount_minor_from_provider, apply_capture, apply_provider_refund
from app.models import AidRequest, Member, Need
from app.routers import paypal as paypal_router
from app.routers.paypal import paypal_webhook_handler, release_dispute_holds


class FakeRequest:
    def __init__(self, event):
        self.event = event
        self.headers = {
            "paypal-auth-algo": "test",
            "paypal-cert-url": "https://example.test/cert",
            "paypal-transmission-id": "test-transmission",
            "paypal-transmission-sig": "test-signature",
            "paypal-transmission-time": "2026-11-11T00:00:00Z",
        }

    async def json(self):
        return self.event


def setup_db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return engine


def test_partial_refunds_are_idempotent_and_cannot_exceed_capture():
    engine = setup_db()
    with Session(engine) as session:
        organization = Organization(id=uid(), name="Test")
        session.add(organization)
        session.flush()
        campaign = Campaign(id=uid(), organization_id=organization.id, name="Refund test", currency="USD")
        session.add(campaign)
        session.flush()
        payment = Payment(
            id=uid(), campaign_id=campaign.id, order_id="ORDER-1", amount_minor=1000,
            currency="USD", status="confirmed", capture_id="CAPTURE-1",
        )
        session.add(payment)
        session.add(Ledger(campaign_id=campaign.id, kind="contribution", amount_minor=1000, reference="test:capture"))
        session.commit()

        assert apply_provider_refund(session, payment, 250, "WH-1", "PAYMENT.CAPTURE.REFUNDED")
        session.commit()
        assert not apply_provider_refund(session, payment, 250, "WH-1", "PAYMENT.CAPTURE.REFUNDED")
        assert apply_provider_refund(session, payment, 750, "WH-2", "PAYMENT.CAPTURE.REFUNDED")
        session.commit()

        assert payment.status == "refunded"
        assert payment.refunded_minor == 1000
        assert calculate_balance(session, campaign.id)["available_minor"] == 0
        assert len(session.scalars(select(ProviderRefund)).all()) == 2
        with pytest.raises(HTTPException) as exc:
            apply_provider_refund(session, payment, 1, "WH-3", "PAYMENT.CAPTURE.REFUNDED")
        assert exc.value.status_code == 409
        assert apply_capture(session, payment, {
            "id": "CAPTURE-1", "status": "COMPLETED",
            "amount": {"currency_code": "USD", "value": "10.00"},
        }) is False
    engine.dispose()


def test_dispute_hold_releases_only_after_provider_confirmed_adjustment():
    engine = setup_db()
    with Session(engine) as session:
        organization = Organization(id=uid(), name="Test")
        session.add(organization)
        session.flush()
        campaign = Campaign(id=uid(), organization_id=organization.id, name="Dispute test", currency="USD")
        session.add(campaign)
        session.flush()
        payment = Payment(
            id=uid(), campaign_id=campaign.id, order_id="ORDER-2", amount_minor=1000,
            currency="USD", status="confirmed", capture_id="CAPTURE-2",
        )
        dispute = PaymentDispute(
            dispute_id="DISPUTE-1", payment_id=payment.id, campaign_id=campaign.id,
            capture_id="CAPTURE-2", amount_minor=600, held_minor=600,
            currency="USD", status="RESOLVED_AWAITING_PROVIDER_DEBIT",
        )
        session.add_all([
            payment, dispute,
            Ledger(campaign_id=campaign.id, kind="contribution", amount_minor=1000, reference="test:dispute-capture"),
            Ledger(campaign_id=campaign.id, kind="reserve", amount_minor=600, reference="paypal:dispute:hold:DISPUTE-1"),
        ])
        session.commit()

        apply_provider_refund(session, payment, 250, "WH-REVERSAL-1", "PAYMENT.CAPTURE.REVERSED")
        release_dispute_holds(session, payment, 250, "WH-REVERSAL-1")
        session.commit()
        assert dispute.held_minor == 350
        assert dispute.status == "PARTIALLY_DEBITED_REVIEW"
        assert calculate_balance(session, campaign.id)["reserved_minor"] == 350
        assert calculate_balance(session, campaign.id)["available_minor"] == 400

        apply_provider_refund(session, payment, 350, "WH-REVERSAL-2", "PAYMENT.CAPTURE.REVERSED")
        release_dispute_holds(session, payment, 350, "WH-REVERSAL-2")
        session.commit()
        assert dispute.held_minor == 0
        assert calculate_balance(session, campaign.id)["reserved_minor"] == 0
        assert calculate_balance(session, campaign.id)["available_minor"] == 400
        assert len(session.scalars(select(Ledger).where(Ledger.kind == "release")).all()) == 2
    engine.dispose()


def test_provider_amount_parser_rejects_invalid_precision():
    assert amount_minor_from_provider("12.34") == 1234
    with pytest.raises(HTTPException):
        amount_minor_from_provider("1.001")
    with pytest.raises(HTTPException):
        amount_minor_from_provider("NaN")


def test_verified_dispute_webhook_holds_funds_until_provider_debit(monkeypatch):
    engine = setup_db()
    monkeypatch.setenv("PAYPAL_WEBHOOK_ID", "WH-TEST")

    async def verify_signature(client, method, path, body=None, request_id=None):
        return {"verification_status": "SUCCESS"}

    monkeypatch.setattr(paypal_router, "paypal_request", verify_signature)

    with Session(engine) as session:
        organization = Organization(id=uid(), name="Test")
        session.add(organization)
        session.flush()
        campaign = Campaign(id=uid(), organization_id=organization.id, name="Dispute webhook", currency="USD")
        session.add(campaign)
        session.flush()
        payment = Payment(
            id=uid(), campaign_id=campaign.id, order_id="ORDER-3", amount_minor=1000,
            currency="USD", status="confirmed", capture_id="CAPTURE-3",
        )
        session.add_all([
            payment,
            Ledger(campaign_id=campaign.id, kind="contribution", amount_minor=1000, reference="test:webhook-capture"),
        ])
        session.commit()

        created = {
            "id": "EVENT-DISPUTE-CREATED", "event_type": "CUSTOMER.DISPUTE.CREATED",
            "resource": {
                "dispute_id": "DISPUTE-WEBHOOK-1",
                "dispute_amount": {"value": "6.00", "currency_code": "USD"},
                "disputed_transactions": [{"seller_transaction_id": "CAPTURE-3"}],
            },
        }
        result = __import__("asyncio").run(paypal_webhook_handler(FakeRequest(created), session))
        assert result["status"] == "processed"
        dispute = session.get(PaymentDispute, "DISPUTE-WEBHOOK-1")
        assert dispute.held_minor == 600
        assert calculate_balance(session, campaign.id)["available_minor"] == 400

        resolved = {
            "id": "EVENT-DISPUTE-RESOLVED", "event_type": "CUSTOMER.DISPUTE.RESOLVED",
            "resource": {
                "dispute_id": "DISPUTE-WEBHOOK-1",
                "dispute_outcome": {"outcome_code": "RESOLVED_BUYER_FAVOUR"},
            },
        }
        __import__("asyncio").run(paypal_webhook_handler(FakeRequest(resolved), session))
        assert dispute.status == "RESOLVED_AWAITING_PROVIDER_DEBIT"
        assert calculate_balance(session, campaign.id)["available_minor"] == 400

        reversed_event = {
            "id": "EVENT-CAPTURE-REVERSED", "event_type": "PAYMENT.CAPTURE.REVERSED",
            "resource": {"id": "CAPTURE-3", "amount": {"value": "6.00", "currency_code": "USD"}},
        }
        __import__("asyncio").run(paypal_webhook_handler(FakeRequest(reversed_event), session))
        assert dispute.status == "PROVIDER_DEBIT_CONFIRMED"
        assert dispute.held_minor == 0
        assert payment.refunded_minor == 600
        assert calculate_balance(session, campaign.id)["confirmed_minor"] == 400
        assert calculate_balance(session, campaign.id)["reserved_minor"] == 0
        assert calculate_balance(session, campaign.id)["available_minor"] == 400
    engine.dispose()
