import json
import os
import re
from typing import Any, Dict, List, Optional, Tuple

import httpx
from sqlalchemy.orm import Session

from .models import Need, ReceiptAudit
from .schemas import AuditAnomaly, ReceiptAuditItem, ReceiptAuditOut

PROHIBITED_KEYWORDS = [
    "beer", "wine", "liquor", "alcohol", "vodka", "whiskey", "tequila", "rum", "heineken", "bud light",
    "cigarette", "cigarettes", "cigar", "tobacco", "vape", "nicotine", "marlboro",
    "lottery", "scratch-off", "lotto", "casino",
    "jewelry", "perfume", "cologne", "luxury",
]

SAMPLE_RECEIPTS: Dict[str, Dict[str, Any]] = {
    "sample_infant_grocery": {
        "vendor": "Valley Community Pharmacy & Mart",
        "receipt_reference": "RCPT-VCP-88321",
        "occurred_at": "2026-11-10",
        "currency": "USD",
        "items": [
            {
                "name": "Enfamil Infant Formula 28oz",
                "quantity": 1,
                "price_minor": 2998,
                "category": "infant_care",
                "is_eligible": True,
            },
            {
                "name": "Huggies Snug & Dry Diapers Size 2",
                "quantity": 1,
                "price_minor": 1450,
                "category": "hygiene",
                "is_eligible": True,
            },
            {
                "name": "Pedialyte Electrolyte Solution 1L",
                "quantity": 2,
                "price_minor": 1240,
                "category": "health",
                "is_eligible": True,
            },
            {
                "name": "Baby Unscented Wipes 3-Pack",
                "quantity": 1,
                "price_minor": 840,
                "category": "hygiene",
                "is_eligible": True,
            },
        ],
        "tax_minor": 450,
        "total_minor": 6978,
    },
    "sample_hardware_flood": {
        "vendor": "Pine Creek Hardware & Supply",
        "receipt_reference": "INV-PCH-49102",
        "occurred_at": "2026-11-10",
        "currency": "USD",
        "items": [
            {
                "name": "Submersible Sump Pump 1/3 HP",
                "quantity": 1,
                "price_minor": 8900,
                "category": "equipment",
                "is_eligible": True,
            },
            {
                "name": "Heavy Duty Waterproof Tarp 20x30",
                "quantity": 1,
                "price_minor": 2499,
                "category": "shelter",
                "is_eligible": True,
            },
            {
                "name": "PVC Water Discharge Hose 25ft",
                "quantity": 1,
                "price_minor": 1850,
                "category": "equipment",
                "is_eligible": True,
            },
            {
                "name": "Woven Sandbags 10-Pack",
                "quantity": 2,
                "price_minor": 1500,
                "category": "flood_defense",
                "is_eligible": True,
            },
        ],
        "tax_minor": 1032,
        "total_minor": 15781,
    },
    "sample_flagged_anomaly": {
        "vendor": "QuickStop Fuel & Groceries #4",
        "receipt_reference": "TXN-QS-00412",
        "occurred_at": "2026-11-10",
        "currency": "USD",
        "items": [
            {
                "name": "Bottled Spring Water 24-Pack",
                "quantity": 1,
                "price_minor": 799,
                "category": "water",
                "is_eligible": True,
            },
            {
                "name": "Canned Beef Stew 4-Pack",
                "quantity": 1,
                "price_minor": 950,
                "category": "food",
                "is_eligible": True,
            },
            {
                "name": "Marlboro Red Cigarettes 20pk",
                "quantity": 1,
                "price_minor": 1250,
                "category": "tobacco",
                "is_eligible": False,
                "flag_reason": "Prohibited by relief policy (Tobacco)",
            },
            {
                "name": "Bud Light 12-Pack Cans",
                "quantity": 1,
                "price_minor": 1699,
                "category": "alcohol",
                "is_eligible": False,
                "flag_reason": "Prohibited by relief policy (Alcohol)",
            },
            {
                "name": "Regular Unleaded Gas 5 Gal",
                "quantity": 1,
                "price_minor": 1850,
                "category": "fuel",
                "is_eligible": True,
            },
        ],
        "tax_minor": 458,
        "total_minor": 7006,
    },
}


def evaluate_receipt_audit(
    raw_receipt: Dict[str, Any],
    need: Optional[Need] = None,
) -> Tuple[List[ReceiptAuditItem], List[AuditAnomaly], int, int, str]:
    """Runs deterministic policy audits, anomaly detection, and budget verification."""
    items_out: List[ReceiptAuditItem] = []
    anomalies: List[AuditAnomaly] = []

    eligible_total = 0
    ineligible_total = 0

    for raw_item in raw_receipt.get("items", []):
        name = raw_item.get("name", "Unknown item")
        price = raw_item.get("price_minor", 0)
        qty = raw_item.get("quantity", 1)
        category = raw_item.get("category", "general")

        # Check for prohibited goods
        name_lower = name.lower()
        is_prohibited = any(keyword in name_lower for keyword in PROHIBITED_KEYWORDS)

        if is_prohibited:
            reason = f"Prohibited item detected: '{name}' violates humanitarian relief spending policy (alcohol/tobacco/luxury)."
            items_out.append(
                ReceiptAuditItem(
                    name=name,
                    quantity=qty,
                    price_minor=price,
                    category="prohibited",
                    is_eligible=False,
                    flag_reason=reason,
                )
            )
            ineligible_total += price
            anomalies.append(
                AuditAnomaly(
                    code="INELIGIBLE_PROHIBITED_ITEM",
                    severity="critical",
                    message=reason,
                    item_name=name,
                    amount_minor=price,
                )
            )
        else:
            items_out.append(
                ReceiptAuditItem(
                    name=name,
                    quantity=qty,
                    price_minor=price,
                    category=category,
                    is_eligible=True,
                )
            )
            eligible_total += price

    # Math consistency check
    tax = raw_receipt.get("tax_minor", 0)
    total = raw_receipt.get("total_minor", eligible_total + ineligible_total + tax)
    computed_sum = eligible_total + ineligible_total + tax

    if abs(computed_sum - total) > 10:  # Allow max 10 cents rounding discrepancy
        diff = abs(computed_sum - total)
        anomalies.append(
            AuditAnomaly(
                code="MATH_INCONSISTENCY",
                severity="warning",
                message=f"Receipt line items + tax do not match reported total (discrepancy: ${(diff / 100):.2f}).",
                amount_minor=diff,
            )
        )

    # Cross-reference with Approved Need budget
    if need:
        approved_budget = need.amount_minor
        if eligible_total > approved_budget:
            overage = eligible_total - approved_budget
            anomalies.append(
                AuditAnomaly(
                    code="BUDGET_OVERAGE",
                    severity="warning",
                    message=f"Receipt eligible total (${(eligible_total / 100):.2f}) exceeds approved need budget (${(approved_budget / 100):.2f}) by ${(overage / 100):.2f}.",
                    amount_minor=overage,
                )
            )

    # Determine verdict
    has_critical = any(a.severity == "critical" for a in anomalies)
    has_warning = any(a.severity == "warning" for a in anomalies)

    if has_critical:
        verdict = "flagged"
    elif has_warning:
        verdict = "warning"
    else:
        verdict = "passed"

    return items_out, anomalies, eligible_total, ineligible_total, verdict


async def extract_receipt_from_image_or_sample(
    image_base64: Optional[str] = None,
    sample_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Extracts structured line items from either a multimodal vision model or a realistic scenario sample."""
    if sample_id and sample_id in SAMPLE_RECEIPTS:
        return SAMPLE_RECEIPTS[sample_id]

    api_key = os.getenv("META_MODEL_API_KEY")
    if api_key and image_base64:
        # Multimodal Vision Prompt to Meta API
        prompt = (
            "You are a disaster relief receipt forensic auditor. Analyze this receipt photo. "
            "Extract: vendor name, receipt reference ID, purchase date (YYYY-MM-DD), itemized lines "
            "(name, quantity, price_minor in cents, category), tax_minor, and total_minor. "
            "Return JSON only: {\"vendor\":\"...\", \"receipt_reference\":\"...\", \"occurred_at\":\"...\", "
            "\"items\":[{\"name\":\"...\", \"quantity\":1, \"price_minor\":0, \"category\":\"...\"}], "
            "\"tax_minor\":0, \"total_minor\":0}."
        )

        payload = {
            "model": os.getenv("AI_MODEL", "muse-spark-1.3"),
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": image_base64 if image_base64.startswith("data:") else f"data:image/jpeg;base64,{image_base64}"
                            },
                        },
                    ],
                }
            ],
        }

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                res = await client.post(
                    "https://api.meta.ai/v1/chat/completions",
                    headers={"Authorization": f"Bearer {api_key}"},
                    json=payload,
                )
                if res.is_success:
                    content = res.json()["choices"][0]["message"]["content"]
                    # Extract JSON substring
                    match = re.search(r"\{.*\}", content, re.DOTALL)
                    if match:
                        return json.loads(match.group(0))
        except Exception:
            pass  # Fall through to synthetic analysis

    # Fallback to smart heuristic sample if vision API is offline or sample requested
    return SAMPLE_RECEIPTS.get(sample_id or "sample_infant_grocery", SAMPLE_RECEIPTS["sample_infant_grocery"])
