import { randomUUID } from 'crypto';
import type {
  AlertStatus,
  ApiDashboard,
  AuditEvent,
  Contribution,
  Cooperative,
  FraudAlert,
  Member,
  RiskCategory,
  WithdrawalRequest,
  WhistleblowerReport,
} from '../types';
import { deriveHealthScore, scoreContribution, scoreWithdrawal } from './riskScoring';
import { createTransfer, createVirtualAccount } from './nombaService';

type DashboardShape = ApiDashboard & { cooperativeId: string; healthScore: number };
type TrustScoreShape = {
  id: string;
  name: string;
  score: number;
  summary: string;
  scoreBreakdown: Array<{ label: string; value: number }>;
  history: number[];
};

const state = {
  cooperatives: [] as Cooperative[],
  members: [] as Member[],
  contributions: [] as Contribution[],
  withdrawals: [] as WithdrawalRequest[],
  signatures: [] as Array<{ id: string; withdrawalRequestId: string; signedBy: string; role: 'treasurer' | 'executive1' | 'executive2'; signedAt: string }>,
  alerts: [] as FraudAlert[],
  reports: [] as WhistleblowerReport[],
  auditLog: [] as AuditEvent[],
  pendingTreasuryCredits: [] as Array<{
    id: string;
    cooperativeId: string;
    amount: number;
    nombaTransactionRef: string;
    source: string;
    createdAt: string;
  }>,
  processedTreasuryCreditRefs: new Set<string>(),
};

const emptyDashboard: DashboardShape = {
  balance: 0,
  nextContribution: 'No active cooperative',
  tenure: '0 Months Active',
  trustScore: 0,
  loanStatus: 'Unavailable',
  activityFeed: [],
  contributionTrend: [],
  contributionHistory: [],
  cooperativeId: '',
  healthScore: 0,
};

const emptyTrustScore: TrustScoreShape = {
  id: '',
  name: 'No cooperative selected',
  score: 0,
  summary: 'Create a cooperative to generate a live trust score.',
  scoreBreakdown: [],
  history: [],
};

function now() {
  return new Date().toISOString();
}

function getCooperative(cooperativeId: string): Cooperative | undefined {
  return state.cooperatives.find((item) => item.id === cooperativeId);
}

function getMember(memberId: string): Member | undefined {
  return state.members.find((item) => item.id === memberId);
}

function getMemberByPhoneNumber(phoneNumber: string): Member | undefined {
  return state.members.find((item) => item.phoneNumber === phoneNumber);
}

function toDashboard(cooperativeId: string): DashboardShape {
  const cooperative = getCooperative(cooperativeId);
  if (!cooperative) {
    return emptyDashboard;
  }
  return {
    ...emptyDashboard,
    cooperativeId: cooperative.id,
    healthScore: cooperative.healthScore,
    balance: cooperative.balance,
    nextContribution: cooperative.expectedContributionAmount
      ? `Next due: ₦${cooperative.expectedContributionAmount.toLocaleString('en-NG')}`
      : 'No active contribution scheduled',
    tenure: '0 Months Active',
    loanStatus: cooperative.balance > 0 ? 'Eligible' : 'Unavailable',
  };
}

function toTrustScore(cooperativeId: string): TrustScoreShape {
  const cooperative = getCooperative(cooperativeId);
  if (!cooperative) {
    return emptyTrustScore;
  }
  return {
    id: cooperative.id,
    name: cooperative.name,
    score: cooperative.healthScore,
    summary: 'This cooperative has not yet accumulated enough live history for a scored summary.',
    scoreBreakdown: [],
    history: [],
  };
}

export function getDashboard(cooperativeId = ''): DashboardShape {
  return toDashboard(cooperativeId);
}

export function getCooperativeOverview(cooperativeId: string) {
  const cooperative = getCooperative(cooperativeId);
  if (!cooperative) {
    return {
      id: '',
      name: '',
      registrationNumber: '',
      state: '',
      cooperativeType: 'thrift' as const,
      nombaVirtualAccountRef: '',
      nombaAccountId: '',
      nombaVirtualAccountNumber: '',
      healthScore: 0,
      healthScoreUpdatedAt: now(),
      isActive: false,
      memberCount: 0,
      balance: 0,
      trustHistory: [],
      scoreBreakdown: [],
    };
  }
  return {
    ...cooperative,
    trustHistory: toTrustScore(cooperativeId).history,
    scoreBreakdown: toTrustScore(cooperativeId).scoreBreakdown,
  };
}

export function getTrustScore(cooperativeId: string) {
  return toTrustScore(cooperativeId);
}

export function listAlerts() {
  return state.alerts;
}

export function getAlert(alertId: string) {
  return state.alerts.find((item) => item.id === alertId);
}

export function listWithdrawals() {
  return state.withdrawals;
}

export function getWithdrawal(withdrawalId: string) {
  return state.withdrawals.find((item) => item.id === withdrawalId);
}

export function listAuditLog(cooperativeId: string) {
  return state.auditLog.filter((event) => event.cooperativeId === cooperativeId);
}

export function listContributions() {
  return state.contributions;
}

export function recordContribution(input: {
  memberId: string;
  cooperativeId: string;
  amount: number;
  expectedAmount?: number;
  duplicateBvn?: boolean;
}) {
  const result = scoreContribution(input);
  const contribution: Contribution = {
    id: randomUUID(),
    memberId: input.memberId,
    cooperativeId: input.cooperativeId,
    amount: input.amount,
    nombaTransactionRef: `txn_${Date.now()}`,
    status: result.riskScore > 0.45 ? 'flagged' : 'confirmed',
    riskScore: result.riskScore,
    contributedAt: now(),
  };

  state.contributions.unshift(contribution);
  const cooperative = getCooperative(input.cooperativeId);
  if (!cooperative) {
    throw new Error(`Cooperative ${input.cooperativeId} not found`);
  }
  cooperative.balance += input.amount;
  state.auditLog.unshift({
    id: randomUUID(),
    cooperativeId: input.cooperativeId,
    eventType: 'contribution_recorded',
    description: 'Contribution ingested and scored by the VeriFund risk engine.',
    metadata: { contributionId: contribution.id, reasons: result.reasons, riskCategory: result.riskCategory },
    createdAt: now(),
  });

  return { contribution, result };
}

export function recordTreasuryCredit(input: {
  cooperativeId: string;
  amount: number;
  nombaTransactionRef: string;
  source: string;
}) {
  const cooperative = getCooperative(input.cooperativeId);
  if (!cooperative) {
    throw new Error(`Cooperative ${input.cooperativeId} not found`);
  }
  if (state.processedTreasuryCreditRefs.has(input.nombaTransactionRef)) {
    return { processed: false, cooperative, reference: input.nombaTransactionRef };
  }

  cooperative.balance += input.amount;
  state.processedTreasuryCreditRefs.add(input.nombaTransactionRef);
  state.auditLog.unshift({
    id: randomUUID(),
    cooperativeId: input.cooperativeId,
    eventType: 'treasury_credit',
    description: 'Treasury credit synced from Nomba polling.',
    metadata: {
      amount: input.amount,
      source: input.source,
      nombaTransactionRef: input.nombaTransactionRef,
    },
    createdAt: now(),
  });

  return { processed: true, cooperative, reference: input.nombaTransactionRef };
}

export function enqueueTreasuryCredit(input: {
  cooperativeId: string;
  amount: number;
  nombaTransactionRef?: string;
  source?: string;
}) {
  const cooperative = getCooperative(input.cooperativeId);
  if (!cooperative) {
    throw new Error(`Cooperative ${input.cooperativeId} not found`);
  }

  const credit = {
    id: randomUUID(),
    cooperativeId: input.cooperativeId,
    amount: input.amount,
    nombaTransactionRef: input.nombaTransactionRef || `txn_${Date.now()}`,
    source: input.source || 'manual-test',
    createdAt: now(),
  };
  state.pendingTreasuryCredits.unshift(credit);
  return credit;
}

export function listPendingTreasuryCredits() {
  return state.pendingTreasuryCredits;
}

export function processPendingTreasuryCredits() {
  const processed: Array<{ id: string; cooperativeId: string; nombaTransactionRef: string }> = [];
  state.pendingTreasuryCredits = state.pendingTreasuryCredits.filter((credit) => {
    const result = recordTreasuryCredit({
      cooperativeId: credit.cooperativeId,
      amount: credit.amount,
      nombaTransactionRef: credit.nombaTransactionRef,
      source: credit.source,
    });
    if (result.processed) {
      processed.push({
        id: credit.id,
        cooperativeId: credit.cooperativeId,
        nombaTransactionRef: credit.nombaTransactionRef,
      });
      return false;
    }
    return true;
  });

  return processed;
}

export function createWithdrawalRequest(input: {
  cooperativeId: string;
  requestedBy: string;
  amount: number;
  destinationAccount: string;
  destinationBankCode: string;
  purpose: string;
  destinationVerified?: boolean;
}) {
  const result = scoreWithdrawal({
    amount: input.amount,
    average30d: 510000,
    signatureCount: 1,
    destinationVerified: input.destinationVerified ?? true,
    purpose: input.purpose,
  });

  const withdrawal: WithdrawalRequest = {
    id: `wf_${Date.now()}`,
    cooperativeId: input.cooperativeId,
    requestedBy: input.requestedBy,
    amount: input.amount,
    destinationAccount: input.destinationAccount,
    destinationBankCode: input.destinationBankCode,
    purpose: input.purpose,
    riskScore: result.riskScore,
    status: result.riskCategory === 'high' ? 'pending_review' : 'pending',
    createdAt: now(),
    average30d: 510000,
    signatureCount: 1,
    explanations: result.reasons,
  };

  state.withdrawals.unshift(withdrawal);
  state.alerts.unshift({
    id: randomUUID(),
    cooperativeId: input.cooperativeId,
    alertType: result.riskCategory === 'high' ? 'anomaly' : 'anomaly',
    riskScore: result.riskScore,
    triggeredBy: 'withdrawal_risk_engine',
    evidenceJson: { ...result.signals, amount: input.amount },
    status: 'open',
    createdAt: now(),
    title: 'Withdrawal risk evaluated',
    reason: result.reasons[0] || 'Automated withdrawal review completed.',
    severity: result.riskCategory === 'high' ? 'High' : result.riskCategory === 'medium' ? 'Medium' : 'Low',
  });

  state.auditLog.unshift({
    id: randomUUID(),
    cooperativeId: input.cooperativeId,
    eventType: 'withdrawal_requested',
    description: 'Withdrawal request created and scored by the risk engine.',
    metadata: { withdrawalId: withdrawal.id, riskCategory: result.riskCategory, reasons: result.reasons },
    createdAt: now(),
  });

  return { withdrawal, result };
}

export function signWithdrawal(withdrawalId: string, signer: { memberId: string; role: 'treasurer' | 'executive1' | 'executive2' }) {
  const withdrawal = getWithdrawal(withdrawalId);
  if (!withdrawal) return undefined;

  const signature = {
    id: randomUUID(),
    withdrawalRequestId: withdrawalId,
    signedBy: signer.memberId,
    role: signer.role,
    signedAt: now(),
  };

  state.signatures.unshift(signature);
  withdrawal.signatureCount += 1;
  withdrawal.status = withdrawal.signatureCount >= 3 ? 'approved' : 'partially_signed';

  state.auditLog.unshift({
    id: randomUUID(),
    cooperativeId: withdrawal.cooperativeId,
    eventType: 'withdrawal_signed',
    description: `Withdrawal ${withdrawalId} signed by ${signer.role}.`,
    metadata: { withdrawalId, signatureCount: withdrawal.signatureCount },
    createdAt: now(),
  });

  return { withdrawal, signature };
}

export async function releaseWithdrawal(withdrawalId: string) {
  const withdrawal = getWithdrawal(withdrawalId);
  if (!withdrawal) return undefined;

  const transfer = await createTransfer({
    amount: withdrawal.amount,
    bankCode: withdrawal.destinationBankCode,
    destinationAccount: withdrawal.destinationAccount,
    narration: withdrawal.purpose,
  });

  withdrawal.status = 'released';
  withdrawal.nombaTransferRef = transfer.transferRef;

  state.auditLog.unshift({
    id: randomUUID(),
    cooperativeId: withdrawal.cooperativeId,
    eventType: 'withdrawal_released',
    description: 'Withdrawal released through the mocked Nomba transfer service.',
    metadata: { withdrawalId, nombaTransferRef: withdrawal.nombaTransferRef },
    createdAt: now(),
  });

  return { withdrawal, transfer };
}

export function createMember(input: { firstName: string; lastName: string; phoneNumber: string; passwordHash: string; bvnHash: string; role?: Member['role'] }) {
  const existingPhoneNumber = state.members.find((member) => member.phoneNumber === input.phoneNumber);
  if (existingPhoneNumber) {
    throw new Error('PHONE_NUMBER_EXISTS');
  }

  const existingBvn = state.members.find((member) => member.bvnHash === input.bvnHash);
  if (existingBvn) {
    throw new Error('BVN_EXISTS');
  }

  const member: Member = {
    id: `mem_${Date.now()}`,
    firstName: input.firstName,
    lastName: input.lastName,
    phoneNumber: input.phoneNumber,
    passwordHash: input.passwordHash,
    bvnHash: input.bvnHash,
    bvnVerified: true,
    bvnVerifiedAt: now(),
    role: input.role || 'member',
    isActive: true,
  };
  state.members.unshift(member);
  return member;
}

export async function createCooperative(input: { name: string; registrationNumber: string; stateName: string; cooperativeType: Cooperative['cooperativeType']; bvn?: string; expectedContributionAmount: number }) {
  const virtualAccount = await createVirtualAccount({
    accountName: input.name,
    accountRef: `va_${input.registrationNumber}`,
    bvn: input.bvn,
    expectedAmount: input.expectedContributionAmount,
  });

  const cooperative: Cooperative = {
    id: input.registrationNumber.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    name: input.name,
    registrationNumber: input.registrationNumber,
    state: input.stateName,
    cooperativeType: input.cooperativeType,
    nombaVirtualAccountRef: virtualAccount.accountRef,
    nombaAccountId: virtualAccount.accountId,
    nombaVirtualAccountNumber: virtualAccount.accountNumber,
    healthScore: 0,
    healthScoreUpdatedAt: now(),
    isActive: true,
    memberCount: 0,
    balance: 0,
    expectedContributionAmount: input.expectedContributionAmount,
  };

  state.cooperatives.unshift(cooperative);
  return { cooperative, virtualAccount };
}

export function createWebhookAudit(input: { cooperativeId: string; eventType: string; description: string; metadata?: Record<string, unknown> }) {
  const event: AuditEvent = {
    id: randomUUID(),
    cooperativeId: input.cooperativeId,
    eventType: input.eventType,
    description: input.description,
    metadata: input.metadata ?? {},
    createdAt: now(),
  };
  state.auditLog.unshift(event);
  return event;
}

export function reportWhistleblower(input: { report: string; supportingDetails?: string }) {
  const report: WhistleblowerReport = {
    id: randomUUID(),
    submittedAt: now(),
    report: input.report,
    supportingDetails: input.supportingDetails,
    status: 'open',
  };
  state.reports.unshift(report);
  const alert = {
    id: randomUUID(),
    cooperativeId: state.cooperatives[0]?.id ?? '',
    alertType: 'whistleblower' as const,
    riskScore: 0.5,
    triggeredBy: 'whistleblower_triage',
    evidenceJson: { report },
    status: 'open' as const,
    createdAt: now(),
    title: 'Anonymous whistleblower report received',
    reason: input.report.slice(0, 160),
    severity: 'Medium' as const,
  };
  state.alerts.unshift(alert);
  return { report, alert };
}

export function recalculateHealthScore(cooperativeId: string) {
  const cooperative = getCooperative(cooperativeId);
  if (!cooperative) {
    return 0;
  }
  const score = deriveHealthScore(cooperative.healthScore, state.alerts.filter((alert) => alert.cooperativeId === cooperativeId));
  cooperative.healthScore = score;
  cooperative.healthScoreUpdatedAt = now();
  return score;
}

export function verifyMemberByBvnHash(bvnHash: string) {
  const existing = state.members.filter((member) => member.bvnHash === bvnHash);
  return {
    verified: existing.length <= 1,
    duplicateCount: existing.length,
  };
}

export function getMemberOrThrow(memberId: string) {
  const member = getMember(memberId);
  if (!member) {
    throw new Error(`Member ${memberId} not found`);
  }
  return member;
}

export function getMemberByPhoneNumberOrThrow(phoneNumber: string) {
  const member = getMemberByPhoneNumber(phoneNumber);
  if (!member) {
    throw new Error(`Member with phone number ${phoneNumber} not found`);
  }
  return member;
}

export function getFirstCooperativeId() {
  return state.cooperatives[0]?.id ?? '';
}

export function listCooperatives() {
  return state.cooperatives;
}

export function getStateSnapshot() {
  return state;
}
