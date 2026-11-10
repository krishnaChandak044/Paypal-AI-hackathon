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
