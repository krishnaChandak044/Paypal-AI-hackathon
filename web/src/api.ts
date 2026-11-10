import {
  AidRequest,
  AiDraftResult,
  BoardData,
  Campaign,
  ExceptionCaseItem,
  PaymentItem,
  PoolBalance,
  ResourceItem,
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
};

