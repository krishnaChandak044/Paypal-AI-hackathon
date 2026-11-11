export interface PoolBalance {
  confirmed_minor: int;
  reserved_minor: int;
  spent_minor: int;
  available_minor: int;
  deficit_minor: int;
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
  is_synthetic?: boolean;
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
  status: 'received' | 'needs_clarification' | 'approved' | 'partially_fulfilled' | 'fulfilled' | 'on_hold' | 'declined' | 'withdrawn' | 'merged';
  created_at?: string;
  is_synthetic?: boolean;
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
  status: 'pending' | 'confirmed' | 'partially_refunded' | 'refunded' | 'failed';
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
  confidence: number | null;
  extraction_source: 'synthetic_sample' | 'meta_vision';
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
  payout_batch_id: string | null;
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
  status: string;
  timestamp?: string | null;
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
  confirmed_at?: string | null;
  timeline: JourneyStep[];
  verified_items_funded: string[];
  ai_impact_narrative: {
    supporter_letter: string;
    social_card: string;
    audit_summary: string;
  };
  privacy_note: string;
}

export interface DuplicateMatch {
  matched_request_id: string;
  matched_message: string;
  matched_status: string;
  matched_created_at: string;
  similarity_score: number;
  similarity_percentage: number;
  confidence_level: 'high' | 'medium' | 'low';
  overlapping_keywords: string[];
  detected_address: string | null;
  potential_savings_minor: number;
  reason: string;
  suggested_action: 'merge' | 'review' | 'keep_separate';
}

export interface RequestDuplicatesResult {
  request_id: string;
  total_matches: number;
  has_high_confidence_duplicate: boolean;
  matches: DuplicateMatch[];
}

export interface RadarSummaryItem {
  has_duplicate: boolean;
  similarity_score: number;
  similarity_percentage: number;
  matched_request_id: string | null;
  reason: string;
  potential_savings_minor: number;
}

export interface MergeRequestResult {
  status: 'merged';
  primary_request_id: string;
  duplicate_request_id: string;
  potential_savings_minor: number;
  audit_action: string;
  message: string;
}

// PayPal Subscriptions & Community Relief Guardian Types
export interface GuardianRecentItem {
  subscription_id: string;
  name: string;
  tier: string;
  amount_minor: number;
  currency: string;
  created_at: string;
}

export interface CommunityResilienceBuffer {
  campaign_id: string;
  total_active_guardians: number;
  monthly_runrate_minor: number;
  monthly_runrate_formatted: string;
  annual_projected_minor: number;
  households_protected: number;
  autonomous_runway_days: number;
  resilience_score: number;
  resilience_rating: string;
  ai_predictive_statement: string;
  estimation_note: string;
  tier_breakdown: {
    community_guardian: number;
    resilience_sentinel: number;
    pool_anchor: number;
    custom: number;
  };
  recent_guardians: GuardianRecentItem[];
}

export interface SubscriptionResult {
  subscription_id: string;
  plan_id: string;
  status: string;
  tier_name: string;
  amount_minor: number;
  currency: string;
  approval_url: string;
  message: string;
}

// Synthetic geographic scenario-map types
export interface GeoCluster {
  sector_id: string;
  name: string;
  sector_code: string;
  description: string;
  map_coordinates: {
    cx: number;
    cy: number;
    radius: number;
  };
  total_requested_minor: number;
  funded_minor: number;
  unmet_minor: number;
  funding_percentage: number;
  status: 'illustrative_full' | 'illustrative_partial';
  badge_label: string;
  color_theme: 'mint' | 'sky' | 'amber';
  active_items: string[];
  payouts_disbursed_count: number;
}

export interface GeoClustersResponse {
  campaign_id: string;
  region_name: string;
  total_sectors: number;
  total_requested_minor: number;
  total_funded_minor: number;
  total_gap_minor: number;
  overall_valley_funded_pct: number;
  data_source: 'synthetic_demo' | string;
  privacy_note: string;
  clusters: GeoCluster[];
}






