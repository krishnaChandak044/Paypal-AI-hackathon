"""Truthful campaign-level copy for future use; it never attributes pooled gifts to recipients."""
from typing import Any, Dict, List, Optional


def generate_synthetic_impact_story(
    amount_str: str,
    currency: str,
    need_description: str,
    vendor: str,
    items: List[Dict[str, Any]],
    payout_batch_id: Optional[str] = None,
) -> Dict[str, str]:
    """Describe pooled contribution and campaign records without claiming individual traceability."""
    del need_description, vendor, items, payout_batch_id
    return {
        "supporter_letter": (
            f"Your {amount_str} {currency} contribution was made to the shared campaign pool. "
            "ReliefRail does not assign an individual donation to a specific request, recipient, "
            "purchase, or payout. Check the campaign's aggregate ledger for separately recorded activity."
        ),
        "social_card": (
            f"I contributed {amount_str} {currency} to a shared community relief pool. "
            "Campaign spending is reported in aggregate and is not attributed to individual gifts."
        ),
        "audit_summary": (
            "Campaign-level contribution and fulfillment records are separate. "
            "No individual donation-to-recipient provenance is asserted."
        ),
    }


async def generate_campaign_pool_summary(
    amount_minor: int,
    currency: str,
    need_description: str,
    vendor: str,
    items: List[Dict[str, Any]],
    payout_batch_id: Optional[str] = None,
) -> Dict[str, str]:
    """Compatibility wrapper returning conservative campaign-level wording."""
    return generate_synthetic_impact_story(
        f"${amount_minor / 100:.2f}", currency, need_description, vendor, items, payout_batch_id
    )
