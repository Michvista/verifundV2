import { clearStoredSession, getStoredToken } from "./session";
import type { UserRole } from "./session";

const baseUrl =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ||
  "http://localhost:5050/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getStoredToken();
  const authHeaders: Record<string, string> = token
    ? { Authorization: `Bearer ${token}` }
    : {};

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
        ...(init?.headers || {}),
      },
    });
  } catch {
    throw new Error(
      "Unable to reach the VeriFund API. Check your connection, wait a moment, then try again.",
    );
  }

  if (!response.ok) {
    if (response.status === 401) {
      clearStoredSession();
    }

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

export type HealthResponse = {
  ok: boolean;
  service: string;
  mode: string;
  nombaMode: "live" | "mock" | string;
  time: string;
};

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

export type TrustScoreResponse = {
  id: string;
  name: string;
  score: number;
  summary: string;
  scoreBreakdown: Array<{ label: string; value: number }>;
  history: number[];
};

export type AuditEvent = {
  id: string;
  cooperativeId: string;
  eventType: string;
  description: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type AuditLogResponse = {
  events: AuditEvent[];
};

export type RiskCategory = "low" | "medium" | "high" | string;

export type RiskSignal = {
  riskScore: number;
  riskCategory: RiskCategory;
  reasons: string[];
};

export type RiskDashboardResponse = RiskSignal & {
  cooperativeId: string;
  contributionSignal: RiskSignal;
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

type RawAlertItem = Omit<AlertItem, "evidence"> & {
  evidence?: Record<string, unknown>;
};

function normalizeAlert(alert: RawAlertItem): AlertItem {
  return {
    ...alert,
    evidence: alert.evidence ?? alert.evidenceJson ?? {},
  };
}

export type QueueItem = {
  id: string;
  cooperativeId: string;
  requestedBy: string;
  requestedById?: string;
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

type RawQueueItem = Omit<QueueItem, "requestedBy"> & {
  requestedBy?: string;
  requestedById?: string;
};

function normalizeQueueItem(item: RawQueueItem): QueueItem {
  return {
    ...item,
    requestedBy: item.requestedBy ?? item.requestedById ?? "unknown",
  };
}

export type CooperativeType = "thrift" | "credit" | "multipurpose";

export type CooperativeResponse = {
  id: string;
  name: string;
  registrationNumber: string;
  state: string;
  cooperativeType: CooperativeType | string;
  nombaVirtualAccountRef: string;
  nombaAccountId: string;
  nombaVirtualAccountNumber?: string;
  healthScore: number;
  healthScoreUpdatedAt?: string;
  isActive: boolean;
  memberCount: number;
  balance: number;
  trustHistory?: number[];
  scoreBreakdown?: Array<{ label: string; value: number }>;
};

export type VirtualAccountResponse = {
  accountId?: string;
  accountRef?: string;
  accountName?: string;
  accountNumber?: string;
  bankName?: string;
  currency?: string;
  provider?: string;
  success?: boolean;
};

export async function getHealth() {
  return request<HealthResponse>("/health");
}

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
    role: UserRole | string;
    bvnVerified: boolean;
    cooperativeId?: string;
  };
  verification: {
    verified: boolean;
    duplicateCount: number;
    bvnNameMatch: boolean;
    details: Record<string, unknown>;
  };
  nomba: {
    accountCreated: boolean;
    virtualAccountCreated: boolean;
    accountRef: string;
    accountNumber?: string;
    bankName?: string;
  };
};

export type RegisterPayload = {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  bvnHash: string;
  role?: UserRole;
};

export async function register(payload: RegisterPayload) {
  return request<RegisterResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export type CreateCooperativePayload = {
  name: string;
  registrationNumber: string;
  stateName: string;
  cooperativeType: CooperativeType;
  bvn?: string;
};

export async function createCooperative(payload: CreateCooperativePayload) {
  return request<{ cooperative: CooperativeResponse; virtualAccount: VirtualAccountResponse }>(
    "/cooperative",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export async function getCooperative(cooperativeId: string) {
  return request<CooperativeResponse>(`/cooperative/${encodeURIComponent(cooperativeId)}`);
}

export async function lookupCooperative(cooperativeId: string) {
  return getCooperative(cooperativeId);
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

export async function getAuditLog(cooperativeId: string) {
  return request<AuditLogResponse>(`/audit/log/${encodeURIComponent(cooperativeId)}`);
}

export async function getRiskDashboard(cooperativeId: string) {
  return request<RiskDashboardResponse>(`/risk/${encodeURIComponent(cooperativeId)}`);
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
  amount: number;
  nombaTransactionRef?: string;
}) {
  return request<{
    success: boolean;
    message: string;
    credit: {
      id: string;
      cooperativeId: string;
      amount: number;
      nombaTransactionRef: string;
      source: string;
      createdAt: string;
    };
    pollResult: {
      trigger: string;
      scannedTransactions: number;
      processedCredits: number;
      queuedCreditsProcessed: number;
      matchedCooperatives: number;
      pendingCredits: number;
      lastRunAt: string;
      source: string;
    };
  }>("/nomba/simulate-deposit", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export type NombaCronStatus = {
  running: boolean;
  lastRunAt: string;
  pendingCredits: number;
  pollIntervalMs: number;
  nombaConfigured: boolean;
};

export type NombaCronRunResponse = {
  trigger: string;
  scannedTransactions: number;
  processedCredits: number;
  queuedCreditsProcessed: number;
  matchedCooperatives: number;
  pendingCredits: number;
  lastRunAt: string;
  source: string;
};

export type NombaCredit = {
  id: string;
  cooperativeId: string;
  amount: number;
  nombaTransactionRef: string;
  source: string;
  createdAt: string;
};

export type NombaTestCreditResponse = {
  queued: boolean;
  credit: NombaCredit;
  note: string;
};

export async function getNombaCronStatus() {
  return request<NombaCronStatus>("/cron/nomba/status");
}

export async function runNombaCron(trigger: "manual" | "test" = "manual") {
  return request<NombaCronRunResponse>("/cron/nomba/run", {
    method: "POST",
    body: JSON.stringify({ trigger }),
  });
}

export async function queueTestNombaCredit(payload: {
  cooperativeId: string;
  amount: number;
  nombaTransactionRef?: string;
}) {
  return request<NombaTestCreditResponse>("/cron/nomba/test-credit", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getAlerts() {
  const response = await request<{ alerts: RawAlertItem[] }>("/alerts");
  return { alerts: response.alerts.map(normalizeAlert) };
}

export async function getAlert(id: string) {
  const alert = await request<RawAlertItem>(`/alerts/${id}`);
  return normalizeAlert(alert);
}

export async function getQueue() {
  const response = await request<{ queue: RawQueueItem[] }>("/withdrawals");
  return { queue: response.queue.map(normalizeQueueItem) };
}

export async function getQueueItem(id: string) {
  const item = await request<RawQueueItem>(`/withdrawals/${id}`);
  return normalizeQueueItem(item);
}

export type RequestWithdrawalPayload = {
  cooperativeId: string;
  requestedBy: string;
  amount: number;
  destinationAccount: string;
  destinationBankCode: string;
  purpose: string;
};

export type RequestWithdrawalResponse = {
  withdrawalId: string;
  riskScore: number;
  riskCategory: string;
  reasons: string[];
  signals?: Record<string, unknown>;
  status: string;
  explanations?: string[];
  destinationAccountName?: string | null;
};

export type WithdrawalRiskPreviewPayload = {
  amount: number;
  average30d: number;
  signatureCount: number;
  destinationVerified: boolean;
  bvnDuplicate?: boolean;
  purpose?: string;
};

export type WithdrawalRiskPreviewResponse = {
  riskScore: number;
  riskCategory: "low" | "medium" | "high" | string;
  reasons: string[];
  signals: {
    ratio: number;
    zScore: number;
    signatureCount: number;
    destinationVerified: boolean;
    bvnDuplicate: boolean;
  };
  explanation: string[];
};

export async function previewWithdrawalRisk(payload: WithdrawalRiskPreviewPayload) {
  return request<WithdrawalRiskPreviewResponse>("/withdrawals/request/preview", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function requestWithdrawal(payload: RequestWithdrawalPayload) {
  return request<RequestWithdrawalResponse>("/withdrawals/request", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export type SignWithdrawalPayload = {
  memberId: string;
  role: UserRole | string;
};

export async function signWithdrawal(
  id: string,
  payload: SignWithdrawalPayload,
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

export type ReleaseWithdrawalPayload = Record<string, never>;

export async function releaseWithdrawal(
  id: string,
  payload: ReleaseWithdrawalPayload = {},
) {
  return request<{ withdrawalId: string; transferRef: string; status: string; provider: string }>(
    `/withdrawals/${id}/release`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export type ContributionPayload = {
  memberId: string;
  cooperativeId: string;
  amount: number;
  expectedAmount?: number;
  duplicateBvn?: boolean;
};

export type ContributionResponse = {
  contribution: {
    id: string;
    memberId: string;
    cooperativeId: string;
    amount: number;
    nombaTransactionRef: string;
    status: string;
    riskScore: number;
    contributedAt: string;
  };
  result: {
    riskScore: number;
    riskCategory: "low" | "medium" | "high" | string;
    reasons: string[];
  };
};

export async function submitContribution(payload: ContributionPayload) {
  return request<ContributionResponse>(`/contribution`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export type WhistleblowerReportPayload = {
  report: string;
  supportingDetails?: string;
};

export type WhistleblowerReportItem = {
  id: string;
  submittedAt: string;
  report: string;
  supportingDetails?: string;
  status: string;
};

export type WhistleblowerResponse = {
  report: WhistleblowerReportItem;
  alert: AlertItem;
};

export async function submitWhistleblowerReport(payload: WhistleblowerReportPayload) {
  const response = await request<{ report: WhistleblowerReportItem; alert: RawAlertItem }>(
    "/fraud/whistleblower/report",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );

  return {
    report: response.report,
    alert: normalizeAlert(response.alert),
  };
}
