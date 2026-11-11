"""Unit checks for request similarity helpers; no seeded personal data or demo token."""


def test_dedup_similarity_heuristics():
    from app.dedup import compute_similarity, extract_street_address

    addr1 = extract_street_address("We are at 104 Riverside Drive with no power")
    addr2 = extract_street_address("Elderly couple at 104 Riverside Dr. basement flooded")
    assert addr1 == "104 riverside drive"
    assert addr2 == "104 riverside drive"

    score, keywords, detected = compute_similarity(
        "104 Riverside Drive, elderly mom needs power for medical equipment and generator",
        "Senior household at 104 Riverside Dr with flooded ground floor. Power cut off; urgently needs generator.",
    )
    assert score >= 0.90
    assert "104 Riverside Drive" in (detected or "")
    assert "generator" in keywords or "power" in keywords

    distinct_score, _, _ = compute_similarity(
        "104 Riverside Drive generator needed",
        "88 Elm Street young mother needs hypoallergenic baby formula and diapers",
    )
    assert distinct_score < 0.40
