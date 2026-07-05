const baseUrl =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ||
  "http://localhost:5050/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = localStorage.getItem("verifund_token");
  const authHeaders: Record<string, string> = token
    ? { Authorization: `Bearer ${token}` }
    : {};

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    let errorMsg = `Request failed: ${response.status}`;
    try {
      const errorJson = JSON.parse(errorText);
      if (errorJson.message) errorMsg = errorJson.message;
    } catch {}
    throw new Error(errorMsg);
  }

  return (await response.json()) as T;
}

export type DashboardResponse = {
  balance: number;
  nextContribution: string;
  tenure: string;
  trustScore: number;
  loanStatus: string;
  activityFeed: Array<{
    id: string;
    title: string;
    text: string;
    time: string;
  }>;
  contributionTrend: number[];
  contributionHistory: Array<{
    id: string;
    date: string;
    amount: number;
    status: "confirmed" | "archived";
    reference: string;
  }>;
  cooperativeId: string;
  healthScore: number;
};

export type NombaTransactionResponse = {
  cooperativeId: string;
  accountNumber: string | null;
  accountRef: string | null;
  provider: string;
  count: number;
  transactions: Array<Record<string, unknown>>;
};

export type TrustScoreResponse = {
  id: string;
  name: string;
  score: number;
  summary: string;
  scoreBreakdown: Array<{ label: string; value: number }>;
  history: number[];
};

export type AlertItem = {
  id: string;
  cooperativeId: string;
  alertType: string;
  riskScore: number;
  triggeredBy: string;
  evidenceJson: Record<string, unknown>;
  status: string;
  createdAt: string;
  title: string;
  reason: string;
  severity: "Low" | "Medium" | "High";
  evidence?: Record<string, unknown>;
  type?: string;
};

export type QueueItem = {
  id: string;
  cooperativeId: string;
  requestedBy: string;
  amount: number;
  destinationAccount: string;
  destinationBankCode: string;
  purpose: string;
  riskScore: number;
  status: string;
  nombaTransferRef?: string;
  createdAt: string;
  average30d: number;
  signatureCount: number;
  explanations: string[];
  ref?: string;
  initiated?: string;
  recipient?: string;
  sigs?: string;
};

export type CooperativeResponse = {
  id: string;
  name: string;
  registrationNumber: string;
  state: string;
  cooperativeType: string;
  createdByMemberId?: string | null;
  contributionAmount: number;
  nombaVirtualAccountRef: string;
  nombaAccountId: string;
  healthScore: number;
  healthScoreUpdatedAt: string;
  isActive: boolean;
  memberCount: number;
  balance: number;
  trustHistory?: number[];
  scoreBreakdown?: Array<{ label: string; value: number }>;
};

export type VirtualAccountResponse = {
  accountId?: string;
  accountRef?: string;
  accountNumber?: string;
  bankName?: string;
  success?: boolean;
};

export type CooperativeAccessResponse = {
  cooperatives: Array<{
    id: string;
    name: string;
    registrationNumber: string;
    role: string;
    createdByMemberId?: string | null;
  }>;
};

export async function login(memberId: string) {
  return request<{
    token: string;
    member: { id: string; firstName: string; lastName: string; role: string };
  }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ memberId }),
  });
}

export type RegisterResponse = {
  member: {
    id: string;
    firstName: string;
    lastName: string;
    role: string;
    bvnVerified: boolean;
    cooperativeId?: string;
  };
  verification: {
    verified: boolean;
    duplicateCount: number;
    bvnNameMatch: boolean;
    details: any;
  };
  nomba: {
    accountCreated: boolean;
    virtualAccountCreated: boolean;
    accountRef: string;
    accountNumber?: string;
    bankName?: string;
  };
};

export async function register(payload: {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  bvnHash: string;
  role?: string;
}) {
  return request<RegisterResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createCooperative(payload: {
  name: string;
  registrationNumber: string;
  stateName: string;
  cooperativeType: string;
  bvn?: string;
  contributionAmount?: number;
}) {
  return request<{ cooperative: CooperativeResponse; virtualAccount: VirtualAccountResponse }>(
    "/cooperative",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export async function getMyCooperatives() {
  return request<CooperativeAccessResponse>('/auth/me/cooperatives');
}

export async function addCooperativeMember(
  cooperativeId: string,
  payload: { memberId: string; role: string },
) {
  return request<{ id: string; cooperativeId: string; memberId: string; role: string }>(
    `/cooperative/${encodeURIComponent(cooperativeId)}/members`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}

export async function getCooperative(cooperativeId: string) {
  return request<CooperativeResponse>(`/cooperative/${encodeURIComponent(cooperativeId)}`);
}

export async function getDashboard(cooperativeId?: string) {
  const suffix = cooperativeId
    ? `?cooperativeId=${encodeURIComponent(cooperativeId)}`
    : "";
  return request<DashboardResponse>(`/dashboard${suffix}`);
}

export async function getTrustScore(cooperativeId: string) {
  return request<TrustScoreResponse>(
    `/cooperative/${encodeURIComponent(cooperativeId)}/trust-score`,
  );
}

export async function getBanks() {
  return request<{
    banks: Array<{ code: string; name: string }>;
    mode: string;
  }>("/nomba/banks");
}

export async function verifyAccount(accountNumber: string, bankCode: string) {
  return request<{
    verified: boolean;
    accountName: string | null;
    provider: string;
    error?: string;
    mode?: string;
  }>("/nomba/verify-account", {
    method: "POST",
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
  }>("/nomba/simulate-deposit", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getNombaCronStatus() {
  return request<{
    running: boolean;
    lastRunAt: string;
    pendingCredits: number;
    pollIntervalMs: number;
    nombaConfigured: boolean;
  }>("/cron/nomba/status");
}

export async function fetchNombaTransactions(cooperativeId: string) {
  return request<NombaTransactionResponse>(
    `/nomba/transactions/${encodeURIComponent(cooperativeId)}`,
  );
}

export async function runNombaCron(trigger: "manual" | "test" = "manual") {
  return request<{
    trigger: string;
    scannedTransactions: number;
    processedCredits: number;
    queuedCreditsProcessed: number;
    matchedCooperatives: number;
    pendingCredits: number;
    lastRunAt: string;
    source: string;
  }>("/cron/nomba/run", {
    method: "POST",
    body: JSON.stringify({ trigger }),
  });
}

export async function queueTestNombaCredit(payload: {
  cooperativeId: string;
  amount: number;
  nombaTransactionRef?: string;
}) {
  return request<{
    queued: boolean;
    credit: { id: string; cooperativeId: string; amount: number; nombaTransactionRef: string; source: string; createdAt: string };
    note: string;
  }>("/cron/nomba/test-credit", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getAlerts() {
  return request<{ alerts: AlertItem[] }>("/alerts");
}

export async function getAlert(id: string) {
  return request<AlertItem>(`/alerts/${id}`);
}

export async function getQueue() {
  return request<{ queue: QueueItem[] }>("/withdrawals");
}

export async function getQueueItem(id: string) {
  return request<QueueItem>(`/withdrawals/${id}`);
}

export async function requestWithdrawal(payload: Record<string, unknown>) {
  return request<{
    withdrawalId: string;
    riskScore: number;
    riskCategory: string;
    reasons: string[];
    status: string;
  }>("/withdrawals/request", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function signWithdrawal(
  id: string,
  payload: Record<string, unknown>,
) {
  return request<{
    withdrawalId: string;
    signatureCount: number;
    status: string;
  }>(`/withdrawals/${id}/sign`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function releaseWithdrawal(
  id: string,
  payload: Record<string, unknown>,
) {
  return request<{ transferRef: string; status: string; provider: string }>(
    `/withdrawals/${id}/release`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export async function submitContribution(payload: Record<string, unknown>) {
  return request(`/contribution`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function submitWhistleblowerReport(payload: {
  report: string;
  supportingDetails?: string;
}) {
  return request<{ success: boolean; whistleblowerReportId: string }>(
    "/fraud/whistleblower/report",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}
