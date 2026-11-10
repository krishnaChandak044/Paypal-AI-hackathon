import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)
headers = {"Authorization": "Bearer demo-coordinator-token"}


def test_anti_fraud_radar_dedup_and_merge():
    # 1. Fetch campaign
    res = client.get("/campaigns", headers=headers)
    assert res.status_code == 200
    campaigns = res.json()
    assert len(campaigns) > 0
    camp_id = campaigns[0]["id"]

    # 2. Simulate duplicate influx
    sim_res = client.post(f"/campaigns/{camp_id}/requests/simulate-duplicate", json={}, headers=headers)
    assert sim_res.status_code == 200
    sim_data = sim_res.json()
    dup_id = sim_data["duplicate_request_id"]
    prim_id = sim_data["primary_request_id"]
    assert dup_id != prim_id

    # 3. Detect duplicates for the incoming request
    dup_check = client.get(f"/campaigns/{camp_id}/requests/{dup_id}/duplicates", headers=headers)
    assert dup_check.status_code == 200
    check_data = dup_check.json()
    assert check_data["total_matches"] >= 1
    assert check_data["has_high_confidence_duplicate"] is True

    top_match = check_data["matches"][0]
    assert top_match["similarity_percentage"] >= 90
    assert "104 Riverside" in (top_match["detected_address"] or "")
    assert top_match["potential_savings_minor"] == 18500
    assert top_match["suggested_action"] == "merge"
    assert "Merge Requests" in top_match["reason"]

    # 4. Check radar summary
    summary_res = client.get(f"/campaigns/{camp_id}/requests/radar/summary", headers=headers)
    assert summary_res.status_code == 200
    summary = summary_res.json()
    assert dup_id in summary
    assert summary[dup_id]["has_duplicate"] is True
    assert summary[dup_id]["similarity_percentage"] >= 90

    # 5. Execute 1-click merge
    merge_res = client.post(
        f"/campaigns/{camp_id}/requests/merge",
        json={
            "primary_request_id": prim_id,
            "duplicate_request_id": dup_id,
            "reason": "Consolidated duplicate flood claim from panicked family member to prevent duplicate payout."
        },
        headers=headers,
    )
    assert merge_res.status_code == 200
    merge_data = merge_res.json()
    assert merge_data["status"] == "merged"
    assert merge_data["potential_savings_minor"] == 18500
    assert "Successfully merged" in merge_data["message"]
    assert "185.00" in merge_data["message"]


def test_dedup_similarity_heuristics():
    from app.dedup import compute_similarity, extract_street_address

    # Address extraction test
    addr1 = extract_street_address("We are at 104 Riverside Drive with no power")
    addr2 = extract_street_address("Elderly couple at 104 Riverside Dr. basement flooded")
    assert addr1 == "104 riverside drive"
    assert addr2 == "104 riverside drive"

    # Similarity scoring test for same house
    score, kw, detected = compute_similarity(
        "104 Riverside Drive, elderly mom needs power for medical equipment and generator",
        "Senior household at 104 Riverside Dr with flooded ground floor. Power cut off; urgently needs generator.",
    )
    assert score >= 0.90
    assert "104 Riverside Drive" in (detected or "")
    assert "generator" in kw or "power" in kw

    # Distinct request test
    distinct_score, _, _ = compute_similarity(
        "104 Riverside Drive generator needed",
        "88 Elm Street young mother needs hypoallergenic baby formula and diapers",
    )
    assert distinct_score < 0.40
