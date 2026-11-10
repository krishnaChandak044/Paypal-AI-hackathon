import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)
headers = {"Authorization": "Bearer demo-coordinator-token"}


def test_predictive_buffer_and_subscriptions():
    # 1. Fetch campaigns
    res = client.get("/campaigns", headers=headers)
    assert res.status_code == 200
    campaigns = res.json()
    assert len(campaigns) > 0
    camp_id = campaigns[0]["id"]

    # 2. Get resilience buffer metrics
    buf_res = client.get(f"/campaigns/{camp_id}/subscriptions/buffer", headers=headers)
    assert buf_res.status_code == 200
    buf_data = buf_res.json()
    assert buf_data["total_active_guardians"] >= 40
    assert buf_data["monthly_runrate_minor"] >= 100000  # >= $1,000/mo
    assert buf_data["households_protected"] >= 10
    assert buf_data["resilience_score"] >= 70
    assert "active monthly PayPal Guardians guarantee" in buf_data["ai_predictive_statement"]

    # 3. Create a new subscription
    sub_res = client.post(
        f"/campaigns/{camp_id}/subscriptions/create",
        json={
            "tier_name": "Resilience Sentinel",
            "amount_minor": 2500,
            "subscriber_name": "Test Local Business",
            "subscriber_email": "test@localbiz.com",
        },
        headers=headers,
    )
    assert sub_res.status_code == 200
    sub_data = sub_res.json()
    assert sub_data["status"] == "ACTIVE"
    assert sub_data["amount_minor"] == 2500
    assert "I-GUARD" in sub_data["subscription_id"]

    # 4. Simulate a guardian addition
    sim_res = client.post(
        f"/campaigns/{camp_id}/subscriptions/simulate-guardian",
        json={
            "tier_name": "Pool Anchor",
            "amount_minor": 5000,
            "donor_name": "Rotary Club of Riverbend",
        },
        headers=headers,
    )
    assert sim_res.status_code == 200
    sim_data = sim_res.json()
    assert sim_data["status"] == "guardian_added"
    assert sim_data["buffer"]["total_active_guardians"] > buf_data["total_active_guardians"]


def test_geographic_clusters_zero_pii():
    # 1. Fetch campaigns
    res = client.get("/campaigns", headers=headers)
    assert res.status_code == 200
    camp_id = res.json()[0]["id"]

    # 2. Get geographic clusters
    geo_res = client.get(f"/campaigns/{camp_id}/geo/clusters", headers=headers)
    assert geo_res.status_code == 200
    geo_data = geo_res.json()
    assert geo_data["total_sectors"] == 5
    assert "Riverbend Valley" in geo_data["region_name"]
    assert geo_data["zero_pii_guarantee"]["pii_redaction_certified"] is True
    assert "K-Anonymity" in geo_data["zero_pii_guarantee"]["privacy_model"]

    # Check sectors
    sector_names = [c["name"] for c in geo_data["clusters"]]
    assert "Riverfront Senior Community" in sector_names
    assert "Valley High School Shelter" in sector_names
    assert "Riverbend Creek Bridge Staging" in sector_names

    # Check first sector values
    sec1 = next(c for c in geo_data["clusters"] if c["sector_id"] == "sector-1")
    assert sec1["total_requested_minor"] > 0
    assert len(sec1["active_items"]) > 0
    assert len(sec1["zero_pii_hash"]) == 16
