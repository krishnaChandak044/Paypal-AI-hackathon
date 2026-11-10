from typing import Optional

from sqlalchemy import Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base, now, uid
from .limits import RateBucket  # noqa: F401 - ensures RateBucket is registered on Base.metadata


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    name: Mapped[str] = mapped_column(String, nullable=False)


class Member(Base):
    __tablename__ = "members"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    role: Mapped[str] = mapped_column(String, nullable=False)
    token_hash: Mapped[str] = mapped_column(String, unique=True, nullable=False)


class Campaign(Base):
    __tablename__ = "campaigns"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    currency: Mapped[str] = mapped_column(String, default="USD", nullable=False)


class AidRequest(Base):
    __tablename__ = "aid_requests"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    campaign_id: Mapped[str] = mapped_column(ForeignKey("campaigns.id"), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String, default="received", nullable=False)
    created_at: Mapped[str] = mapped_column(String, default=now, nullable=False)


class Need(Base):
    __tablename__ = "needs"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    request_id: Mapped[str] = mapped_column(ForeignKey("aid_requests.id"), nullable=False)
    description: Mapped[str] = mapped_column(String, nullable=False)
    amount_minor: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String, default="draft", nullable=False)


class Ledger(Base):
    __tablename__ = "ledger"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    campaign_id: Mapped[str] = mapped_column(ForeignKey("campaigns.id"), nullable=False)
    need_id: Mapped[Optional[str]] = mapped_column(ForeignKey("needs.id"), nullable=True)
    kind: Mapped[str] = mapped_column(String, nullable=False)  # 'contribution', 'reserve', 'release', 'spend', 'refund'
    amount_minor: Mapped[int] = mapped_column(Integer, nullable=False)
    reference: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    created_at: Mapped[str] = mapped_column(String, default=now, nullable=False)


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    campaign_id: Mapped[str] = mapped_column(ForeignKey("campaigns.id"), nullable=False)
    order_id: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    amount_minor: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, default="pending", nullable=False)
    capture_id: Mapped[Optional[str]] = mapped_column(String, unique=True, nullable=True)


class WebhookEvent(Base):
    __tablename__ = "webhook_events"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    event_type: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[str] = mapped_column(String, default=now, nullable=False)


class Audit(Base):
    __tablename__ = "audit"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(String, nullable=False)
    actor_id: Mapped[str] = mapped_column(String, nullable=False)
    action: Mapped[str] = mapped_column(String, nullable=False)
    entity_id: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[str] = mapped_column(String, default=now, nullable=False)


class Resource(Base):
    __tablename__ = "resources"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    campaign_id: Mapped[str] = mapped_column(ForeignKey("campaigns.id"), nullable=False)
    description: Mapped[str] = mapped_column(String, nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    source: Mapped[str] = mapped_column(String, nullable=False)
    confirmed_at: Mapped[str] = mapped_column(String, default=now, nullable=False)


class ExceptionCase(Base):
    __tablename__ = "exceptions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    campaign_id: Mapped[str] = mapped_column(ForeignKey("campaigns.id"), nullable=False)
    need_id: Mapped[Optional[str]] = mapped_column(ForeignKey("needs.id"), nullable=True)
    reason: Mapped[str] = mapped_column(String, nullable=False)
    owner_id: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, default="open", nullable=False)


class RecipientAccess(Base):
    __tablename__ = "recipient_access"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    request_id: Mapped[str] = mapped_column(ForeignKey("aid_requests.id"), unique=True, nullable=False)
    token_hash: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    created_at: Mapped[str] = mapped_column(String, default=now, nullable=False)


class RequestRevision(Base):
    __tablename__ = "request_revisions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    request_id: Mapped[str] = mapped_column(ForeignKey("aid_requests.id"), nullable=False)
    actor_id: Mapped[str] = mapped_column(String, nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[str] = mapped_column(String, default=now, nullable=False)


class Receipt(Base):
    __tablename__ = "receipts"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    ledger_id: Mapped[str] = mapped_column(ForeignKey("ledger.id"), unique=True, nullable=False)
    vendor: Mapped[str] = mapped_column(String, nullable=False)
    receipt_reference: Mapped[str] = mapped_column(String, nullable=False)
    occurred_at: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, default="unreconciled", nullable=False)
    reconciled_by: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    reconciled_at: Mapped[Optional[str]] = mapped_column(String, nullable=True)


class ReceiptAudit(Base):
    __tablename__ = "receipt_audits"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    campaign_id: Mapped[str] = mapped_column(ForeignKey("campaigns.id"), nullable=False)
    need_id: Mapped[Optional[str]] = mapped_column(ForeignKey("needs.id"), nullable=True)
    ledger_id: Mapped[Optional[str]] = mapped_column(ForeignKey("ledger.id"), nullable=True)
    vendor: Mapped[str] = mapped_column(String, nullable=False)
    receipt_reference: Mapped[str] = mapped_column(String, nullable=False)
    occurred_at: Mapped[str] = mapped_column(String, nullable=False)
    total_minor: Mapped[int] = mapped_column(Integer, nullable=False)
    tax_minor: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    eligible_total_minor: Mapped[int] = mapped_column(Integer, nullable=False)
    ineligible_total_minor: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    items_json: Mapped[str] = mapped_column(Text, nullable=False)
    anomalies_json: Mapped[str] = mapped_column(Text, nullable=False)
    verdict: Mapped[str] = mapped_column(String, nullable=False)  # 'passed', 'warning', 'flagged'
    confidence: Mapped[float] = mapped_column(Float, default=0.96, nullable=False)
    created_at: Mapped[str] = mapped_column(String, default=now, nullable=False)


class Payout(Base):
    __tablename__ = "payouts"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    campaign_id: Mapped[str] = mapped_column(ForeignKey("campaigns.id"), nullable=False)
    need_id: Mapped[str] = mapped_column(ForeignKey("needs.id"), nullable=False)
    ledger_id: Mapped[str] = mapped_column(ForeignKey("ledger.id"), nullable=False)
    payout_batch_id: Mapped[str] = mapped_column(String, nullable=False)
    payout_item_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    recipient_email: Mapped[str] = mapped_column(String, nullable=False)
    recipient_name: Mapped[str] = mapped_column(String, default="Field Coordinator", nullable=False)
    recipient_type: Mapped[str] = mapped_column(String, default="volunteer_lead", nullable=False)
    amount_minor: Mapped[int] = mapped_column(Integer, nullable=False)
    fee_minor: Mapped[int] = mapped_column(Integer, default=25, nullable=False)
    currency: Mapped[str] = mapped_column(String, default="USD", nullable=False)
    status: Mapped[str] = mapped_column(String, default="SUCCESS", nullable=False)
    purpose_note: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[str] = mapped_column(String, default=now, nullable=False)


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    kind: Mapped[str] = mapped_column(String, nullable=False)
    entity_id: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, default="pending", nullable=False)
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[str] = mapped_column(String, default=now, nullable=False)


class Subscription(Base):
    __tablename__ = "subscriptions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    campaign_id: Mapped[str] = mapped_column(ForeignKey("campaigns.id"), nullable=False)
    subscription_id: Mapped[str] = mapped_column(String, unique=True, nullable=False)  # PayPal sub ID: I-XXXXX
    plan_id: Mapped[str] = mapped_column(String, nullable=False)  # PayPal Plan ID: P-XXXXX
    subscriber_email: Mapped[str] = mapped_column(String, nullable=False)
    subscriber_name: Mapped[str] = mapped_column(String, default="Community Guardian", nullable=False)
    tier_name: Mapped[str] = mapped_column(String, default="Community Guardian", nullable=False)
    amount_minor: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String, default="USD", nullable=False)
    status: Mapped[str] = mapped_column(String, default="ACTIVE", nullable=False)
    interval_unit: Mapped[str] = mapped_column(String, default="MONTH", nullable=False)
    created_at: Mapped[str] = mapped_column(String, default=now, nullable=False)
    last_payment_at: Mapped[Optional[str]] = mapped_column(String, nullable=True)

