"""Illustrative geographic coverage values for the synthetic ReliefRail demo.

This module intentionally does not read request narratives or recipient locations.
It is not a privacy mechanism and must not be used as operational reporting.
"""
from typing import Any, Dict, List


DEMO_SECTORS = [
    ("sector-1", "Riverfront Senior Community", "ZONE-NORTH-RIVER", {"cx": 220, "cy": 140, "radius": 45}, "Illustrative senior-support area", 18500, 18500, ["Emergency power kits", "Medical device batteries"]),
    ("sector-2", "Valley High School Shelter", "ZONE-CENTRAL-SHELTER", {"cx": 470, "cy": 210, "radius": 50}, "Illustrative shelter area", 8500, 5000, ["Infant supplies", "Thermal bedding"]),
    ("sector-3", "Riverbend Creek Bridge Staging", "ZONE-SOUTH-BRIDGE", {"cx": 340, "cy": 360, "radius": 48}, "Illustrative volunteer staging area", 14000, 14000, ["Water pumps", "Safety equipment"]),
    ("sector-4", "Mill Street Commercial & Pharmacy", "ZONE-WEST-COMMERCE", {"cx": 180, "cy": 290, "radius": 40}, "Illustrative supply area", 9500, 6500, ["First-aid supplies", "Drinking water"]),
    ("sector-5", "Pine Creek Basin Lowlands", "ZONE-EAST-BASIN", {"cx": 610, "cy": 310, "radius": 42}, "Illustrative lowland area", 12000, 4500, ["Sandbags", "Weather tarps"]),
]


def get_geographic_need_clusters(session: Any, campaign_id: str) -> Dict[str, Any]:
    """Return clearly labelled static example data; never infer geography from case text."""
    clusters: List[Dict[str, Any]] = []
    for sector_id, name, code, coords, description, requested, funded, items in DEMO_SECTORS:
        pct = round(funded * 100 / requested) if requested else 0
        status = "illustrative_full" if pct >= 100 else "illustrative_partial"
        clusters.append({
            "sector_id": sector_id,
            "name": name,
            "sector_code": code,
            "description": description,
            "map_coordinates": coords,
            "total_requested_minor": requested,
            "funded_minor": funded,
            "unmet_minor": max(0, requested - funded),
            "funding_percentage": pct,
            "status": status,
            "badge_label": f"Illustrative {pct}% scenario",
            "color_theme": "mint" if pct >= 100 else "sky",
            "active_items": items,
            "payouts_disbursed_count": 0,
        })

    requested_total = sum(x["total_requested_minor"] for x in clusters)
    funded_total = sum(x["funded_minor"] for x in clusters)
    return {
        "campaign_id": campaign_id,
        "region_name": "Illustrative Riverbend Valley",
        "total_sectors": len(clusters),
        "total_requested_minor": requested_total,
        "total_funded_minor": funded_total,
        "total_gap_minor": max(0, requested_total - funded_total),
        "overall_valley_funded_pct": round(funded_total * 100 / requested_total) if requested_total else 0,
        "data_source": "synthetic_demo",
        "privacy_note": "Static fictional examples only. No recipient locations are processed. This is not a privacy certification or live campaign report.",
        "clusters": clusters,
    }
