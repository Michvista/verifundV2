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

  return (await response.json().catch(() => ({}))) as T;
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

export type HealthResponse = {
  ok: boolean;
  service: string;
  mode: string;
  nombaMode: "live" | "mock" | string;
  databaseMode?: "postgres" | "memory" | string;
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

function normalizeAlert(alert: Partial<RawAlertItem> = {}): AlertItem {
  return {
    ...alert,
    id: asString(alert.id, "unknown-alert"),
    cooperativeId: asString(alert.cooperativeId),
    alertType: asString(alert.alertType, "unknown"),
    riskScore: asNumber(alert.riskScore),
    triggeredBy: asString(alert.triggeredBy, "system"),
    evidenceJson: alert.evidenceJson ?? {},
    status: asString(alert.status, "open"),
    createdAt: asString(alert.createdAt, new Date().toISOString()),
    title: asString(alert.title, "Fraud alert"),
    reason: asString(alert.reason, "No reason supplied."),
    severity: asString(alert.severity, "Low") as AlertItem["severity"],
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

function normalizeQueueItem(item: Partial<RawQueueItem> = {}): QueueItem {
  return {
    ...item,
    id: asString(item.id, "unknown-withdrawal"),
    cooperativeId: asString(item.cooperativeId),
    requestedBy: asString(item.requestedBy ?? item.requestedById, "unknown"),
    amount: asNumber(item.amount),
    destinationAccount: asString(item.destinationAccount),
    destinationBankCode: asString(item.destinationBankCode),
    purpose: asString(item.purpose),
    riskScore: asNumber(item.riskScore),
    status: asString(item.status, "pending"),
    createdAt: asString(item.createdAt, new Date().toISOString()),
    average30d: asNumber(item.average30d),
    signatureCount: asNumber(item.signatureCount),
    explanations: asArray<string>(item.explanations),
    ref: item.ref,
    initiated: item.initiated,
    recipient: item.recipient,
    sigs: item.sigs,
  };
}

function normalizeDashboard(data: Partial<DashboardResponse>): DashboardResponse {
  return {
    balance: asNumber(data.balance),
    nextContribution: asString(data.nextContribution, "Unavailable"),
    tenure: asString(data.tenure, "Unavailable"),
    trustScore: asNumber(data.trustScore),
    loanStatus: asString(data.loanStatus, "Unavailable"),
    activityFeed: asArray<Partial<DashboardResponse["activityFeed"][number]>>(data.activityFeed).map((item, index) => ({
      id: asString(item.id, `activity-${index}`),
      title: asString(item.title, "Activity"),
      text: asString(item.text, "No details supplied."),
      time: asString(item.time, "recently"),
    })),
    contributionTrend: asArray<number>(data.contributionTrend).map((value) => asNumber(value)),
    contributionHistory: asArray<Partial<DashboardResponse["contributionHistory"][number]>>(data.contributionHistory).map(
      (item, index) => ({
        id: asString(item.id, `contribution-${index}`),
        date: asString(item.date, "Unknown date"),
        amount: asNumber(item.amount),
        status: asString(item.status, "confirmed") as DashboardResponse["contributionHistory"][number]["status"],
        reference: asString(item.reference, "N/A"),
      }),
    ),
    cooperativeId: asString(data.cooperativeId),
    healthScore: asNumber(data.healthScore),
  };
}

function normalizeRiskSignal(signal?: Partial<RiskSignal>): RiskSignal {
  return {
    riskScore: asNumber(signal?.riskScore),
    riskCategory: asString(signal?.riskCategory, "low"),
    reasons: asArray<string>(signal?.reasons),
  };
}

function normalizeRiskDashboard(data: Partial<RiskDashboardResponse>): RiskDashboardResponse {
  return {
    cooperativeId: asString(data.cooperativeId),
    ...normalizeRiskSignal(data),
    contributionSignal: normalizeRiskSignal(data.contributionSignal),
  };
}

function normalizeTrustScore(data: Partial<TrustScoreResponse>): TrustScoreResponse {
  return {
    id: asString(data.id),
    name: asString(data.name, "Unknown cooperative"),
    score: asNumber(data.score),
    summary: asString(data.summary, "Trust score is unavailable."),
    scoreBreakdown: asArray<TrustScoreResponse["scoreBreakdown"][number]>(data.scoreBreakdown),
    history: asArray<number>(data.history).map((value) => asNumber(value)),
  };
}

function normalizeCooperative(data: Partial<CooperativeResponse>): CooperativeResponse {
  return {
    id: asString(data.id),
    name: asString(data.name, "Unknown cooperative"),
    registrationNumber: asString(data.registrationNumber),
    state: asString(data.state),
    cooperativeType: asString(data.cooperativeType, "thrift"),
    nombaVirtualAccountRef: asString(data.nombaVirtualAccountRef),
    nombaAccountId: asString(data.nombaAccountId),
    nombaVirtualAccountNumber: data.nombaVirtualAccountNumber,
    healthScore: asNumber(data.healthScore),
    healthScoreUpdatedAt: data.healthScoreUpdatedAt,
    isActive: Boolean(data.isActive),
    memberCount: asNumber(data.memberCount),
    balance: asNumber(data.balance),
    expectedContributionAmount:
      data.expectedContributionAmount === undefined
        ? undefined
        : asNumber(data.expectedContributionAmount),
    trustHistory: data.trustHistory
      ? asArray<number>(data.trustHistory).map((value) => asNumber(value))
      : undefined,
    scoreBreakdown: data.scoreBreakdown
      ? asArray<NonNullable<CooperativeResponse["scoreBreakdown"]>[number]>(data.scoreBreakdown)
      : undefined,
  };
}

function normalizeAuditEvent(event: Partial<AuditEvent> = {}, index = 0): AuditEvent {
  return {
    id: asString(event.id, `audit-${index}`),
    cooperativeId: asString(event.cooperativeId),
    eventType: asString(event.eventType, "audit_event"),
    description: asString(event.description, "No description supplied."),
    metadata: event.metadata && typeof event.metadata === "object" ? event.metadata : {},
    createdAt: asString(event.createdAt, new Date().toISOString()),
  };
}

function normalizeWithdrawalResponse(response: Partial<RequestWithdrawalResponse> = {}): RequestWithdrawalResponse {
  return {
    withdrawalId: asString(response.withdrawalId),
    riskScore: asNumber(response.riskScore),
    riskCategory: asString(response.riskCategory, "low"),
    reasons: asArray<string>(response.reasons),
    signals: response.signals,
    status: asString(response.status, "pending"),
    explanations: asArray<string>(response.explanations),
    destinationAccountName: response.destinationAccountName ?? null,
  };
}

function normalizeContributionResponse(response: Partial<ContributionResponse> = {}): ContributionResponse {
  return {
    contribution: {
      id: asString(response.contribution?.id),
      memberId: asString(response.contribution?.memberId),
      cooperativeId: asString(response.contribution?.cooperativeId),
      amount: asNumber(response.contribution?.amount),
      nombaTransactionRef: asString(response.contribution?.nombaTransactionRef),
      status: asString(response.contribution?.status, "confirmed"),
      riskScore: asNumber(response.contribution?.riskScore),
      contributedAt: asString(response.contribution?.contributedAt, new Date().toISOString()),
    },
    result: {
      riskScore: asNumber(response.result?.riskScore),
      riskCategory: asString(response.result?.riskCategory, "low"),
      reasons: asArray<string>(response.result?.reasons),
    },
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
  expectedContributionAmount?: number;
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

export type LoginPayload = {
  identifier: string;
  password: string;
};

export async function login(payload: LoginPayload) {
  return request<{
    token: string;
    member: { id: string; firstName: string; lastName: string; role: string };
  }>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
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
  password: string;
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
  expectedContributionAmount: number;
};

export async function createCooperative(payload: CreateCooperativePayload) {
  const response = await request<{ cooperative: Partial<CooperativeResponse>; virtualAccount: VirtualAccountResponse }>(
    "/cooperative",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
  return {
    cooperative: normalizeCooperative(response.cooperative ?? {}),
    virtualAccount: response.virtualAccount ?? {},
  };
}

export async function getCooperative(cooperativeId: string) {
  return normalizeCooperative(
    await request<Partial<CooperativeResponse>>(`/cooperative/${encodeURIComponent(cooperativeId)}`),
  );
}

export async function lookupCooperative(cooperativeId: string) {
  return getCooperative(cooperativeId);
}

export async function getDashboard(cooperativeId?: string) {
  const suffix = cooperativeId
    ? `?cooperativeId=${encodeURIComponent(cooperativeId)}`
    : "";
  return normalizeDashboard(await request<Partial<DashboardResponse>>(`/dashboard${suffix}`));
}

export async function getTrustScore(cooperativeId: string) {
  return normalizeTrustScore(
    await request<Partial<TrustScoreResponse>>(
      `/cooperative/${encodeURIComponent(cooperativeId)}/trust-score`,
    ),
  );
}

export async function getAuditLog(cooperativeId: string) {
  const response = await request<Partial<AuditLogResponse>>(`/audit/log/${encodeURIComponent(cooperativeId)}`);
  return { events: asArray<Partial<AuditEvent>>(response.events).map(normalizeAuditEvent) };
}

export async function getRiskDashboard(cooperativeId: string) {
  return normalizeRiskDashboard(
    await request<Partial<RiskDashboardResponse>>(`/risk/${encodeURIComponent(cooperativeId)}`),
  );
}

export async function getBanks() {
  const response = await request<{
    banks: Array<{ code: string; name: string }>;
    mode: string;
  }>("/nomba/banks");
  return {
    banks: asArray<{ code: string; name: string }>(response.banks),
    mode: asString(response.mode, "unknown"),
  };
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
  const response = await request<{ alerts: Array<Partial<RawAlertItem>> }>("/alerts");
  return { alerts: asArray<Partial<RawAlertItem>>(response.alerts).map(normalizeAlert) };
}

export async function getAlert(id: string) {
  const alert = await request<Partial<RawAlertItem>>(`/alerts/${id}`);
  return normalizeAlert(alert);
}

export async function getQueue() {
  const response = await request<{ queue: Array<Partial<RawQueueItem>> }>("/withdrawals");
  return { queue: asArray<Partial<RawQueueItem>>(response.queue).map(normalizeQueueItem) };
}

export async function getQueueItem(id: string) {
  const item = await request<Partial<RawQueueItem>>(`/withdrawals/${id}`);
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
  const response = await request<Partial<WithdrawalRiskPreviewResponse>>("/withdrawals/request/preview", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return {
    riskScore: asNumber(response.riskScore),
    riskCategory: asString(response.riskCategory, "low"),
    reasons: asArray<string>(response.reasons),
    signals: {
      ratio: asNumber(response.signals?.ratio, 1),
      zScore: asNumber(response.signals?.zScore),
      signatureCount: asNumber(response.signals?.signatureCount),
      destinationVerified: Boolean(response.signals?.destinationVerified),
      bvnDuplicate: Boolean(response.signals?.bvnDuplicate),
    },
    explanation: asArray<string>(response.explanation),
  };
}

export async function requestWithdrawal(payload: RequestWithdrawalPayload) {
  const response = await request<Partial<RequestWithdrawalResponse>>("/withdrawals/request", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return normalizeWithdrawalResponse(response);
}

export type SignWithdrawalPayload = {
  memberId?: string;
  role?: UserRole | string;
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
  const response = await request<Partial<ContributionResponse>>(`/contribution`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return normalizeContributionResponse(response);
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
