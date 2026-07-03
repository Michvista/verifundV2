import {
  alerts as localAlerts,
  dashboard as localDashboard,
  pendingQueue as localQueue,
  trustBars as localTrustBars,
  trustHistory as localTrustHistory,
} from '../data';

const baseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'http://localhost:5050/api';

async function request<T>(path: string, init?: RequestInit, fallback?: T): Promise<T> {
  const token = localStorage.getItem('verifund_token');
  const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
        ...(init?.headers || {}),
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      let errorMsg = `Request failed: ${response.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.message) errorMsg = errorJson.message;
      } catch {}
      throw new Error(errorMsg);
    }

    return (await response.json()) as T;
  } catch (_error) {
    if (fallback !== undefined) return fallback;
    throw _error;
  }
}

export type DashboardResponse = typeof localDashboard & {
  cooperativeId: string;
  healthScore: number;
};

export type TrustScoreResponse = {
  id: string;
  name: string;
  score: number;
  summary: string;
  scoreBreakdown: typeof localTrustBars;
  history: number[];
};

export type AlertItem = (typeof localAlerts)[number] & {
  id: string;
  riskScore: number;
  evidence: Record<string, unknown>;
};

export type QueueItem = (typeof localQueue)[number] & {
  id: string;
  riskScore: number;
  destinationAccount: string;
  destinationBankCode: string;
  purpose: string;
  requestedBy: string;
  signatureCount: number;
  average30d: number;
  explanations: string[];
};

export async function login(memberId: string) {
  return request<{ token: string; member: { id: string; firstName: string; lastName: string; role: string } }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ memberId }),
  });
}

export type RegisterResponse = {
  member: { id: string; firstName: string; lastName: string; role: string; cooperativeId?: string };
  verification: { verified: boolean; duplicateCount: number; bvnNameMatch: boolean; details: any };
  nomba: { accountCreated: boolean; virtualAccountCreated: boolean; accountRef: string; accountNumber?: string; bankName?: string };
};

export async function register(payload: {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  bvnHash: string;
}) {
  return request<RegisterResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getBanks() {
  return request<{ banks: Array<{ code: string; name: string }>; mode: string }>('/nomba/banks');
}

export async function verifyAccount(accountNumber: string, bankCode: string) {
  return request<{ verified: boolean; accountName: string | null; provider: string; error?: string }>('/nomba/verify-account', {
    method: 'POST',
    body: JSON.stringify({ accountNumber, bankCode }),
  });
}

export async function simulateDeposit(payload: {
  cooperativeId: string;
  memberId?: string;
  amount: number;
  expectedAmount?: number;
  duplicateBvn?: boolean;
  historyCount?: number;
}) {
  return request<{
    success: boolean;
    message: string;
    payload: any;
    signature: string;
    response: any;
  }>('/nomba/simulate-deposit', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getDashboard() {
  return request<DashboardResponse>('/dashboard', undefined, {
    ...localDashboard,
    cooperativeId: 'okafor-farmers-thrift',
    healthScore: 92,
  });
}

export async function getTrustScore(cooperativeId: string) {
  return request<TrustScoreResponse>(`/cooperative/${cooperativeId}/trust-score`, undefined, {
    id: cooperativeId,
    name: 'Okafor Farmers Thrift & Credit',
    score: 92,
    summary: 'This cooperative maintains a 98% timely contribution rate and has no outstanding dispute records.',
    scoreBreakdown: localTrustBars,
    history: localTrustHistory,
  });
}

export async function getAlerts() {
  return request<{ alerts: AlertItem[] }>('/alerts', undefined, {
    alerts: localAlerts.map((a, idx) => ({
      ...a,
      id: `alert-mock-${idx}`,
      riskScore: a.severity === 'High' ? 0.85 : 0.45,
      evidence: { details: a.reason },
    })) as AlertItem[],
  });
}

export async function getAlert(id: string) {
  return request<AlertItem>(`/alerts/${id}`);
}

export async function getQueue() {
  return request<{ queue: QueueItem[] }>('/withdrawals', undefined, {
    queue: localQueue.map((q) => ({
      ...q,
      destinationAccount: '0123456789',
      destinationBankCode: '058',
      purpose: 'Emergency Member Loan disbursement',
      requestedBy: 'Treasurer',
      signatureCount: q.sigs.split('■').length - 1,
      average30d: 500000,
      explanations: [q.status],
    })) as QueueItem[],
  });
}

export async function getQueueItem(id: string) {
  return request<QueueItem>(`/withdrawals/${id}`);
}

export async function requestWithdrawal(payload: Record<string, unknown>) {
  return request<{ withdrawalId: string; riskScore: number; riskCategory: string; reasons: string[]; status: string }>(
    '/withdrawals/request',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}

export async function signWithdrawal(id: string, payload: Record<string, unknown>) {
  return request<{ withdrawalId: string; signatureCount: number; status: string }>(`/withdrawals/${id}/sign`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function releaseWithdrawal(id: string, payload: Record<string, unknown>) {
  return request<{ transferRef: string; status: string; provider: string }>(`/withdrawals/${id}/release`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function createVirtualAccount(cooperativeId: string, payload: Record<string, unknown>) {
  return request(`/cooperatives/${cooperativeId}/virtual-account`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function submitContribution(payload: Record<string, unknown>) {
  return request(`/contribution`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function submitWhistleblowerReport(payload: { report: string; supportingDetails?: string }) {
  return request<{ success: boolean; whistleblowerReportId: string }>('/fraud/whistleblower/report', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

