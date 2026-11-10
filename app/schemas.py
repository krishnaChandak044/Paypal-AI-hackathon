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
    confidence: float
    need_comparison: Optional[Dict[str, Any]] = None


class ApplyAuditIn(BaseModel):
    audit_id: str
    need_id: str
    reference: str
    note: str
