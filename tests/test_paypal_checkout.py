"""Regression coverage for the non-JavaScript PayPal approval return flow."""

import asyncio

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.database import Base, uid
from app.models import Campaign, Member, Organization
from app.routers import paypal as paypal_router
from app.routers.paypal import create_paypal_order, paypal_checkout_context
from app.schemas import OrderIn


def test_checkout_context_uses_local_return_and_cancel_urls(monkeypatch):
    monkeypatch.delenv("RELIEFRAIL_APP_URL", raising=False)

    assert paypal_checkout_context() == {
        "return_url": "http://127.0.0.1:3000/?paypal=return",
        "cancel_url": "http://127.0.0.1:3000/?paypal=cancel",
        "user_action": "PAY_NOW",
        "shipping_preference": "NO_SHIPPING",
    }


def test_non_local_checkout_url_requires_https(monkeypatch):
    monkeypatch.setenv("RELIEFRAIL_APP_URL", "http://demo.example.com")

    with pytest.raises(HTTPException) as exc:
        paypal_checkout_context()

    assert exc.value.status_code == 500


def test_order_creation_sends_paypal_buyer_return_context(monkeypatch):
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    monkeypatch.setenv("RELIEFRAIL_APP_URL", "https://demo.example.test")
    captured = {}

    async def fake_paypal_request(client, method, path, body, request_id):
        captured["method"] = method
        captured["path"] = path
        captured["body"] = body
        return {
            "id": "ORDER-RETURN-TEST",
            "links": [{"rel": "approve", "href": "https://www.sandbox.paypal.com/checkoutnow?token=ORDER-RETURN-TEST"}],
        }

    monkeypatch.setattr(paypal_router, "paypal_request", fake_paypal_request)

    with Session(engine) as session:
        organization = Organization(id=uid(), name="Checkout test organization")
        session.add(organization)
        session.flush()
        campaign = Campaign(id=uid(), organization_id=organization.id, name="Checkout test", currency="USD")
        member = Member(
            id=uid(), organization_id=organization.id, name="Checkout operator",
            role="admin", token_hash="not-used-in-direct-router-test",
        )
        session.add_all([campaign, member])
        session.commit()

        result = asyncio.run(create_paypal_order(campaign.id, OrderIn(amount_minor=100), session, member))

        assert result["status"] == "pending"
        assert captured["method"] == "POST"
        assert captured["path"] == "/v2/checkout/orders"
        payload = captured["body"]
        context = payload["payment_source"]["paypal"]["experience_context"]
        assert context["return_url"] == "https://demo.example.test/?paypal=return"
        assert context["cancel_url"] == "https://demo.example.test/?paypal=cancel"
        assert context["user_action"] == "PAY_NOW"
        assert context["shipping_preference"] == "NO_SHIPPING"
        assert payload["purchase_units"][0]["amount"] == {"currency_code": "USD", "value": "1.00"}

    engine.dispose()
