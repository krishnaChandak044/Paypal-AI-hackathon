export interface PoolBalance {
  confirmed_minor: int;
  reserved_minor: int;
  spent_minor: int;
  available_minor: int;
}

export type int = number;

export interface Campaign {
  id: string;
  name: string;
  currency: string;
}

export interface BoardNeed {
  need_id: string;
  description: string;
  requested_minor: number;
  reserved_minor: number;
  spent_minor: number;
  unmet_minor: number;
  urgency?: 'immediate' | 'recovery';
}

export interface BoardData {
  currency: string;
  pool: PoolBalance;
  needs: BoardNeed[];
}

export interface AidRequest {
  id: string;
  message: string;
  status: 'received' | 'needs_clarification' | 'approved' | 'partially_fulfilled' | 'fulfilled' | 'on_hold' | 'declined' | 'withdrawn';
  created_at?: string;
}

export interface StructuredNeed {
  description: string;
  amount_minor: number;
}

export interface AiDraftResult {
  needs: StructuredNeed[];
  questions: string[];
  uncertainties: string[];
}

export interface ResourceItem {
  id: string;
  description: string;
  quantity: number;
  source: string;
  confirmed_at: string;
}

export interface ExceptionCaseItem {
  id: string;
  need_id: string | null;
  reason: string;
  owner_id: string;
  status: string;
}

export interface UnreconciledItem {
  ledger_id: string;
  amount_minor: number;
  receipt_status: 'missing' | 'unreconciled' | 'reconciled';
}

export interface PaymentItem {
  order_id: string;
  status: 'pending' | 'confirmed' | 'refunded' | 'failed';
  amount_minor: number;
  currency: string;
  capture_id: string | null;
}

export interface ReceiptAuditItem {
  name: string;
  quantity: number;
  price_minor: number;
  category: string;
  is_eligible: boolean;
  flag_reason?: string | null;
}

export interface AuditAnomaly {
  code: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  item_name?: string | null;
  amount_minor?: number | null;
}

export interface ReceiptAuditResult {
  audit_id: string;
  vendor: string;
  receipt_reference: string;
  occurred_at: string;
  total_minor: number;
  tax_minor: number;
  eligible_total_minor: number;
  ineligible_total_minor: number;
  items: ReceiptAuditItem[];
  anomalies: AuditAnomaly[];
  verdict: 'passed' | 'warning' | 'flagged';
  confidence: number;
  need_comparison?: {
    need_id: string;
    need_description: string;
    budget_minor: number;
    eligible_spend_minor: number;
    difference_minor: number;
    is_over_budget: boolean;
  } | null;
}

export interface HistoricalAuditItem {
  id: string;
  vendor: string;
  receipt_reference: string;
  total_minor: number;
  eligible_total_minor: number;
  ineligible_total_minor: number;
  verdict: 'passed' | 'warning' | 'flagged';
  occurred_at: string;
  created_at: string;
}

export interface DisbursePayoutIn {
  recipient_email: string;
  recipient_name: string;
  recipient_type: 'volunteer_lead' | 'certified_supplier' | 'displaced_family';
  amount_minor: number;
  purpose_note: string;
}

export interface PayoutItem {
  payout_id: string;
  need_id: string;
  ledger_id: string;
  payout_batch_id: string;
  payout_item_id: string | null;
  recipient_email: string;
  recipient_name: string;
  recipient_type: string;
  amount_minor: number;
  fee_minor: number;
  currency: string;
  status: string;
  purpose_note: string;
  created_at: string;
  mode: string;
}

export interface JourneyStep {
  stage: number;
  title: string;
  subtitle: string;
  description: string;
  status: 'completed' | 'allocated' | 'disbursed' | 'audited';
  timestamp: string;
  reference: string;
  badge: string;
}

export interface PayPalImpactJourneyResult {
  order_id: string;
  capture_id: string | null;
  amount_minor: number;
  currency: string;
  campaign_name: string;
  status: string;
  confirmed_at: string;
  timeline: JourneyStep[];
  verified_items_funded: string[];
  ai_impact_narrative: {
    supporter_letter: string;
    social_card: string;
    audit_summary: string;
  };
  zero_pii_certificate: {
    zero_pii_verified: boolean;
    classification: string;
    redactions_enforced: string[];
    compliance_standard: string;
    audit_hash: string;
  };
}




