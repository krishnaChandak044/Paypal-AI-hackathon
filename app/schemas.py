from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field


class OrgIn(BaseModel):
    name: str = Field(min_length=2, max_length=120, description="Organization name")
    admin_name: str = Field(min_length=2, max_length=120, description="Initial administrator name")


class CampaignIn(BaseModel):
    name: str = Field(min_length=2, max_length=120, description="Campaign name")
    currency: str = Field(pattern="^[A-Z]{3}$", default="USD", description="3-letter ISO currency code")


class MemberIn(BaseModel):
    name: str = Field(min_length=2, max_length=120, description="Member name")
    role: Literal["admin", "organizer", "finance", "viewer"] = Field(description="Role within the organization")


class RequestIn(BaseModel):
    message: str = Field(min_length=4, max_length=10000, description="Incoming aid request message narrative")


class NeedIn(BaseModel):
    description: str = Field(min_length=2, max_length=500, description="Item or assistance need description")
    amount_minor: int = Field(ge=0, description="Estimated amount in currency minor units (e.g. cents)")


class AllocationIn(BaseModel):
    amount_minor: int = Field(gt=0, description="Amount to reserve in minor units")
    reference: str = Field(min_length=4, max_length=120, description="Unique reference code for this allocation")


class ResourceIn(BaseModel):
    description: str = Field(min_length=2, max_length=500, description="Resource or capacity description")
    quantity: int = Field(ge=0, description="Available quantity or count")
    source: str = Field(min_length=2, max_length=200, description="Origin or provider of the resource")


class ExceptionIn(BaseModel):
    reason: str = Field(min_length=4, max_length=500, description="Reason for the exception/issue")
    owner_id: str = Field(description="Member ID of the accountable owner")
    need_id: Optional[str] = Field(default=None, description="Optional associated need ID")


class OrderIn(BaseModel):
    amount_minor: int = Field(gt=0, le=100_000_000, description="Contribution amount in currency minor units")


class SettlementIn(BaseModel):
    amount_minor: int = Field(gt=0, description="Amount to spend or release in minor units")
    reference: str = Field(min_length=4, max_length=120, description="Unique transaction reference code")
    note: str = Field(min_length=4, max_length=500, description="Explanation or audit note")


class RecipientRequestIn(BaseModel):
    message: str = Field(min_length=4, max_length=10000, description="Request narrative from recipient")


class StatusIn(BaseModel):
    status: Literal["needs_clarification", "on_hold", "declined", "withdrawn"]
    reason: str = Field(min_length=4, max_length=500, description="Reason for the status transition")


class ReceiptIn(BaseModel):
    vendor: str = Field(min_length=2, max_length=120, description="Vendor or merchant name")
    receipt_reference: str = Field(min_length=4, max_length=200, description="Receipt reference or receipt number")
    occurred_at: str = Field(min_length=10, max_length=40, description="ISO-8601 date/time when purchase occurred")


# Multimodal Receipt AI Scanner & Audit Validator Schemas
class ReceiptScanIn(BaseModel):
    campaign_id: str = Field(description="Target campaign ID")
    need_id: Optional[str] = Field(default=None, description="Associated approved need to cross-validate against")
    image_base64: Optional[str] = Field(default=None, description="Base64 encoded receipt image or data URL")
    sample_id: Optional[str] = Field(default=None, description="Pre-loaded realistic demo receipt sample ID")


class ReceiptAuditItem(BaseModel):
    name: str
    quantity: int = 1
    price_minor: int
    category: str
    is_eligible: bool = True
    flag_reason: Optional[str] = None


class AuditAnomaly(BaseModel):
    code: str
    severity: Literal["critical", "warning", "info"]
    message: str
    item_name: Optional[str] = None
    amount_minor: Optional[int] = None


class ReceiptAuditOut(BaseModel):
    audit_id: str
    vendor: str
    receipt_reference: str
    occurred_at: str
    total_minor: int
    tax_minor: int
    eligible_total_minor: int
    ineligible_total_minor: int
    items: List[ReceiptAuditItem]
    anomalies: List[AuditAnomaly]
    verdict: Literal["passed", "warning", "flagged"]
    confidence: Optional[float] = None
    extraction_source: Literal["synthetic_sample", "meta_vision"]
    need_comparison: Optional[Dict[str, Any]] = None


class ApplyAuditIn(BaseModel):
    audit_id: str
    need_id: str
    reference: str
    note: str


# PayPal Outflow Payouts & Crisis Simulator Schemas
class DisbursePayoutIn(BaseModel):
    recipient_email: str = Field(description="Recipient's PayPal email or sandbox account")
    recipient_name: str = Field(default="Field Coordinator", description="Name of recipient or supplier")
    recipient_type: Literal["volunteer_lead", "certified_supplier", "displaced_family"] = "volunteer_lead"
    amount_minor: int = Field(gt=0, description="Amount to disburse in minor units (cents)")
    purpose_note: str = Field(min_length=5, max_length=500, description="Specific humanitarian relief purpose")


class PayoutOut(BaseModel):
    payout_id: str
    need_id: str
    ledger_id: str
    payout_batch_id: Optional[str]
    payout_item_id: Optional[str]
    recipient_email: str
    recipient_name: str
    recipient_type: str
    amount_minor: int
    fee_minor: int
    currency: str
    status: str
    purpose_note: str
    created_at: str
    mode: str


class SimulateCrisisIn(BaseModel):
    scenario: Literal["flash_flood_wave", "power_outage_freeze", "urban_wildfire"] = "flash_flood_wave"


# PayPal order and shared-pool record journey schemas
class JourneyStep(BaseModel):
    stage: int
    title: str
    subtitle: str
    description: str
    status: str
    timestamp: Optional[str] = None
    reference: str
    badge: str


class PayPalImpactJourneyOut(BaseModel):
    order_id: str
    capture_id: Optional[str] = None
    amount_minor: int
    currency: str
    campaign_name: str
    status: str
    confirmed_at: Optional[str] = None
    timeline: List[JourneyStep]
    verified_items_funded: List[str]
    ai_impact_narrative: Dict[str, str]
    privacy_note: str


# Semantic Deduplication & Anti-Fraud Radar Schemas
class DuplicateMatchOut(BaseModel):
    matched_request_id: str
    matched_message: str
    matched_status: str
    matched_created_at: str
    similarity_score: float
    similarity_percentage: int
    confidence_level: Literal["high", "medium", "low"]
    overlapping_keywords: List[str]
    detected_address: Optional[str] = None
    potential_savings_minor: int
    reason: str
    suggested_action: Literal["merge", "review", "keep_separate"] = "merge"


class RequestDuplicatesOut(BaseModel):
    request_id: str
    total_matches: int
    has_high_confidence_duplicate: bool
    matches: List[DuplicateMatchOut]


class MergeRequestIn(BaseModel):
    primary_request_id: str
    duplicate_request_id: str
    reason: Optional[str] = "Consolidated duplicate claims from same household to prevent double disbursement."


class MergeRequestOut(BaseModel):
    status: Literal["merged"]
    primary_request_id: str
    duplicate_request_id: str
    potential_savings_minor: int
    audit_action: str
    message: str


class SimulateDuplicateIn(BaseModel):
    address: Optional[str] = "104 Riverside Drive"
    equipment: Optional[str] = "portable emergency generator"


# PayPal Subscriptions & Predictive Pool Buffer AI Schemas
class CreateSubscriptionIn(BaseModel):
    tier_name: Literal["Community Guardian", "Resilience Sentinel", "Pool Anchor", "Custom"] = "Resilience Sentinel"
    amount_minor: int = Field(gt=0, description="Monthly recurring contribution in minor currency units (cents)")
    subscriber_name: str = Field(default="Community Guardian", min_length=2, max_length=120)
    subscriber_email: str = Field(min_length=5, max_length=150)


class SubscriptionOut(BaseModel):
    subscription_id: str
    plan_id: str
    status: str
    tier_name: str
    amount_minor: int
    currency: str
    approval_url: str
    message: str


class CommunityResilienceBufferOut(BaseModel):
    campaign_id: str
    total_active_guardians: int
    monthly_runrate_minor: int
    monthly_runrate_formatted: str
    annual_projected_minor: int
    households_protected: int
    autonomous_runway_days: float
    resilience_score: int
    resilience_rating: str
    ai_predictive_statement: str
    estimation_note: str
    tier_breakdown: Dict[str, int]
    recent_guardians: List[Dict[str, Any]]


# Synthetic geographic scenario-map schemas
class GeoClusterOut(BaseModel):
    sector_id: str
    name: str
    sector_code: str
    description: str
    map_coordinates: Dict[str, Any]
    total_requested_minor: int
    funded_minor: int
    unmet_minor: int
    funding_percentage: int
    status: str
    badge_label: str
    color_theme: str
    active_items: List[str]
    payouts_disbursed_count: int


class GeoClustersResponseOut(BaseModel):
    campaign_id: str
    region_name: str
    total_sectors: int
    total_requested_minor: int
    total_funded_minor: int
    total_gap_minor: int
    overall_valley_funded_pct: int
    data_source: str
    privacy_note: str
    clusters: List[GeoClusterOut]




