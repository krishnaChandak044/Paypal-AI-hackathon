import {
  AidRequest,
  AiDraftResult,
  BoardData,
  Campaign,
  CommunityResilienceBuffer,
  DuplicateMatch,
  ExceptionCaseItem,
  GeoClustersResponse,
  MergeRequestResult,
  PaymentItem,
  PoolBalance,
  RadarSummaryItem,
  RequestDuplicatesResult,
  ResourceItem,
  SubscriptionResult,
  UnreconciledItem,
} from './types';

const TOKEN_KEY = 'reliefrail_auth_token';

export function getAuthToken(): string {
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function setAuthToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

function authHeaders(): HeadersInit {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: {
      ...authHeaders(),
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    let detail = `Error ${res.status}`;
    try {
      const data = await res.json();
      detail = data.detail || detail;
    } catch {
      // Ignore
    }
    throw new Error(detail);
  }

  return res.json();
}

export const api = {
  // Campaigns
  async getCampaigns(): Promise<Campaign[]> {
    return request<Campaign[]>('/campaigns');
  },

  async getBoard(campaignId: string): Promise<BoardData> {
    return request<BoardData>(`/campaigns/${campaignId}/board`);
  },

  async getPool(campaignId: string): Promise<PoolBalance & { currency: string }> {
    return request<PoolBalance & { currency: string }>(`/campaigns/${campaignId}/pool`);
  },

  // Requests & Needs
  async getRequests(campaignId: string): Promise<AidRequest[]> {
    return request<AidRequest[]>(`/campaigns/${campaignId}/requests`);
  },

  async createRequest(campaignId: string, message: string): Promise<{ id: string; status: string }> {
    return request(`/campaigns/${campaignId}/requests`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  },

  async createNeed(requestId: string, description: string, amount_minor: number): Promise<{ id: string; status: string }> {
    return request(`/requests/${requestId}/needs`, {
      method: 'POST',
      body: JSON.stringify({ description, amount_minor }),
    });
  },

  async approveNeed(needId: string): Promise<{ status: string }> {
    return request(`/needs/${needId}/approve`, {
      method: 'POST',
    });
  },

  async aiDraft(requestId: string): Promise<{ draft: AiDraftResult; status: string }> {
    return request(`/requests/${requestId}/ai-draft`, {
      method: 'POST',
    });
  },

  // Allocations & Ledger
  async reserveNeed(needId: string, amount_minor: number, reference: string): Promise<{ id: string }> {
    return request(`/needs/${needId}/reserve`, {
      method: 'POST',
      body: JSON.stringify({ amount_minor, reference }),
    });
  },

  async spendNeed(needId: string, amount_minor: number, reference: string, note: string): Promise<{ id: string }> {
    return request(`/needs/${needId}/spend`, {
      method: 'POST',
      body: JSON.stringify({ amount_minor, reference, note }),
    });
  },

  // Receipts & Reconciliation
  async attachReceipt(ledgerId: string, vendor: string, receipt_reference: string, occurred_at: string): Promise<{ id: string }> {
    return request(`/spending/${ledgerId}/receipt`, {
      method: 'POST',
      body: JSON.stringify({ vendor, receipt_reference, occurred_at }),
    });
  },

  async reconcileReceipt(receiptId: string): Promise<{ status: string }> {
    return request(`/receipts/${receiptId}/reconcile`, {
      method: 'POST',
    });
  },

  async getUnreconciled(campaignId: string): Promise<UnreconciledItem[]> {
    return request<UnreconciledItem[]>(`/campaigns/${campaignId}/unreconciled`);
  },

  // Multimodal AI Receipt Scanner & Policy Audit
  async scanAndAuditReceipt(
    campaignId: string,
    needId?: string,
    imageBase64?: string,
    sampleId?: string,
    syntheticDemoConfirmed = false
  ): Promise<any> {
    return request('/receipts/scan-and-audit', {
      method: 'POST',
      body: JSON.stringify({
        campaign_id: campaignId,
        need_id: needId || null,
        image_base64: imageBase64 || null,
        sample_id: sampleId || null,
        synthetic_demo_confirmed: syntheticDemoConfirmed,
      }),
    });
  },

  async applyAuditedReceipt(
    auditId: string,
    needId: string,
    reference: string,
    note: string
  ): Promise<{ status: string; ledger_id: string; receipt_id: string; amount_spent_minor: number }> {
    return request('/receipts/audit/apply', {
      method: 'POST',
      body: JSON.stringify({
        audit_id: auditId,
        need_id: needId,
        reference,
        note,
      }),
    });
  },

  async getReceiptAudits(campaignId: string): Promise<any[]> {
    return request(`/campaigns/${campaignId}/receipt-audits`);
  },

  // Resources
  async getResources(campaignId: string): Promise<ResourceItem[]> {
    return request<ResourceItem[]>(`/campaigns/${campaignId}/resources`);
  },

  async addResource(campaignId: string, description: string, quantity: number, source: string): Promise<{ id: string }> {
    return request(`/campaigns/${campaignId}/resources`, {
      method: 'POST',
      body: JSON.stringify({ description, quantity, source }),
    });
  },

  // Exceptions
  async getExceptions(campaignId: string): Promise<ExceptionCaseItem[]> {
    return request<ExceptionCaseItem[]>(`/campaigns/${campaignId}/exceptions`);
  },

  async addException(campaignId: string, reason: string, owner_id: string, need_id?: string): Promise<{ id: string }> {
    return request(`/campaigns/${campaignId}/exceptions`, {
      method: 'POST',
      body: JSON.stringify({ reason, owner_id, need_id }),
    });
  },

  // PayPal Sandbox Contributions
  async createPayPalOrder(campaignId: string, amount_minor: number): Promise<{
    order_id: string;
    status: string;
    links: { rel: string; href: string }[];
  }> {
    return request(`/campaigns/${campaignId}/paypal/orders`, {
      method: 'POST',
      body: JSON.stringify({ amount_minor }),
    });
  },

  async capturePayPalOrder(orderId: string): Promise<{ status: string; capture_id: string }> {
    return request(`/paypal/orders/${orderId}/capture`, {
      method: 'POST',
    });
  },

  async getPayments(campaignId: string): Promise<PaymentItem[]> {
    return request<PaymentItem[]>(`/campaigns/${campaignId}/payments`);
  },

  // PayPal Outflow Payouts (Fast-Grants Disbursal)
  async disbursePayPalPayout(
    needId: string,
    data: {
      recipient_email: string;
      recipient_name: string;
      recipient_type: string;
      amount_minor: number;
      purpose_note: string;
    }
  ): Promise<any> {
    return request(`/needs/${needId}/payout`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getCampaignPayouts(campaignId: string): Promise<any[]> {
    return request(`/campaigns/${campaignId}/payouts`);
  },

  async reconcilePayout(payoutId: string): Promise<any> {
    return request(`/payouts/${payoutId}/reconcile`, { method: 'POST' });
  },

  async retryPayout(payoutId: string): Promise<any> {
    return request(`/payouts/${payoutId}/retry`, { method: 'POST' });
  },

  async explainPayout(payoutId: string): Promise<{
    status: string;
    facts: Record<string, unknown>;
    explanation: string;
    suggested_next_step: string;
    disclaimer: string;
  }> {
    return request(`/payouts/${payoutId}/explain`, { method: 'POST' });
  },

  async simulateCrisis(campaignId: string, scenario: string = 'flash_flood_wave'): Promise<{
    status: string;
    scenario: string;
    items_created: number;
    items_reused: number;
    details: any[];
  }> {
    return request(`/campaigns/${campaignId}/simulate-crisis`, {
      method: 'POST',
      body: JSON.stringify({ scenario }),
    });
  },

  // PayPal order and shared-pool record journey
  async getPayPalOrderJourney(orderId: string): Promise<any> {
    const res = await fetch(`/paypal/orders/${encodeURIComponent(orderId)}/journey`);
    if (!res.ok) {
      throw new Error('Unable to retrieve PayPal impact journey.');
    }
    return res.json();
  },

  // Recipient Public Portal
  async publicIntake(campaignId: string, message: string): Promise<{ request_id: string; access_token: string; status: string }> {
    return request(`/campaigns/${campaignId}/recipient-intake`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  },

  async getRecipientStatus(requestId: string, token: string): Promise<{ id: string; status: string; created_at: string }> {
    const res = await fetch(`/recipient/requests/${requestId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    if (!res.ok) throw new Error('Request not found or invalid token');
    return res.json();
  },

  async clarifyRecipientRequest(requestId: string, token: string, message: string): Promise<{ status: string }> {
    const res = await fetch(`/recipient/requests/${requestId}/clarify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ message }),
    });
    if (!res.ok) throw new Error('Failed to update request');
    return res.json();
  },

  // Deterministic text/address similarity review
  async getRequestDuplicates(campaignId: string, requestId: string): Promise<RequestDuplicatesResult> {
    return request(`/campaigns/${campaignId}/requests/${requestId}/duplicates`);
  },

  async getRadarSummary(campaignId: string): Promise<Record<string, RadarSummaryItem>> {
    return request(`/campaigns/${campaignId}/requests/radar/summary`);
  },

  async mergeRequests(
    campaignId: string,
    primaryRequestId: string,
    duplicateRequestId: string,
    reason?: string
  ): Promise<MergeRequestResult> {
    return request(`/campaigns/${campaignId}/requests/merge`, {
      method: 'POST',
      body: JSON.stringify({
        primary_request_id: primaryRequestId,
        duplicate_request_id: duplicateRequestId,
        reason: reason || 'Consolidated duplicate claims from same household to prevent double disbursement.',
      }),
    });
  },

  async simulateDuplicate(campaignId: string): Promise<{
    status: string;
    primary_request_id: string;
    duplicate_request_id: string;
    duplicate_message: string;
    potential_savings_minor: number;
    reused: boolean;
  }> {
    return request(`/campaigns/${campaignId}/requests/simulate-duplicate`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  },

  // PayPal Subscriptions & Predictive Pool Buffer AI
  async getResilienceBuffer(campaignId: string): Promise<CommunityResilienceBuffer> {
    return request(`/campaigns/${campaignId}/subscriptions/buffer`);
  },

  async createSubscription(
    campaignId: string,
    payload: {
      tier_name: string;
      amount_minor: number;
      subscriber_name: string;
      subscriber_email: string;
    }
  ): Promise<SubscriptionResult> {
    return request(`/campaigns/${campaignId}/subscriptions/create`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // Synthetic geographic scenario map
  async getGeoClusters(campaignId: string): Promise<GeoClustersResponse> {
    return request(`/campaigns/${campaignId}/geo/clusters`);
  },
};

