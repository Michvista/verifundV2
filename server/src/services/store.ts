import { randomUUID } from 'crypto';
import {
  seedAlerts,
  seedAuditLog,
  seedCooperative,
  seedContributions,
  seedDashboard,
  seedMembers,
  seedReports,
  seedWithdrawals,
} from '../data/seed';
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
  cooperatives: [seedCooperative],
  members: [...seedMembers],
  contributions: [...seedContributions],
  withdrawals: [...seedWithdrawals],
  signatures: [] as Array<{ id: string; withdrawalRequestId: string; signedBy: string; role: 'treasurer' | 'executive1' | 'executive2'; signedAt: string }>,
  alerts: [...seedAlerts],
  reports: [...seedReports],
  auditLog: [...seedAuditLog],
};

function now() {
  return new Date().toISOString();
}

function getCooperative(cooperativeId: string): Cooperative {
  return state.cooperatives.find((item) => item.id === cooperativeId) ?? state.cooperatives[0];
}

function getMember(memberId: string): Member | undefined {
  return state.members.find((item) => item.id === memberId);
}

function toDashboard(cooperativeId: string): DashboardShape {
  const cooperative = getCooperative(cooperativeId);
  return {
    ...seedDashboard,
    cooperativeId: cooperative.id,
    healthScore: cooperative.healthScore,
  };
}

function toTrustScore(cooperativeId: string): TrustScoreShape {
  const cooperative = getCooperative(cooperativeId);
  return {
    id: cooperative.id,
    name: cooperative.name,
    score: cooperative.healthScore,
    summary: 'This cooperative maintains a 98% timely contribution rate and has no outstanding dispute records.',
    scoreBreakdown: [
      { label: 'Member Verification', value: 95 },
      { label: 'Contribution Regularity', value: 88 },
      { label: 'Loan Liquidity', value: 91 },
      { label: 'Governance Transparency', value: 100 },
      { label: 'External Audit Status', value: 85 },
    ],
    history: [...seedDashboard.contributionTrend].map((value, index) => value + index * 2),
  };
}

export function getDashboard(cooperativeId = state.cooperatives[0].id): DashboardShape {
  return toDashboard(cooperativeId);
}

export function getCooperativeOverview(cooperativeId: string) {
  const cooperative = getCooperative(cooperativeId);
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

export function releaseWithdrawal(withdrawalId: string) {
  const withdrawal = getWithdrawal(withdrawalId);
  if (!withdrawal) return undefined;

  withdrawal.status = 'released';
  withdrawal.nombaTransferRef = createTransfer({
    amount: withdrawal.amount,
    bankCode: withdrawal.destinationBankCode,
    destinationAccount: withdrawal.destinationAccount,
    narration: withdrawal.purpose,
  }).transferRef;

  state.auditLog.unshift({
    id: randomUUID(),
    cooperativeId: withdrawal.cooperativeId,
    eventType: 'withdrawal_released',
    description: 'Withdrawal released through the mocked Nomba transfer service.',
    metadata: { withdrawalId, nombaTransferRef: withdrawal.nombaTransferRef },
    createdAt: now(),
  });

  return withdrawal;
}

export function createMember(input: { firstName: string; lastName: string; phoneNumber: string; bvnHash: string }) {
  const existing = state.members.find((member) => member.bvnHash === input.bvnHash);
  const member: Member = {
    id: `mem_${Date.now()}`,
    firstName: input.firstName,
    lastName: input.lastName,
    phoneNumber: input.phoneNumber,
    bvnHash: input.bvnHash,
    bvnVerified: !existing,
    bvnVerifiedAt: !existing ? now() : undefined,
    role: 'member',
    isActive: true,
  };
  state.members.unshift(member);
  return member;
}

export function createCooperative(input: { name: string; registrationNumber: string; stateName: string; cooperativeType: Cooperative['cooperativeType']; bvn?: string }) {
  const virtualAccount = createVirtualAccount({
    accountName: input.name,
    accountRef: `va_${input.registrationNumber}`,
    bvn: input.bvn,
    expectedAmount: 20000,
  });

  const cooperative: Cooperative = {
    id: input.registrationNumber.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    name: input.name,
    registrationNumber: input.registrationNumber,
    state: input.stateName,
    cooperativeType: input.cooperativeType,
    nombaVirtualAccountRef: virtualAccount.accountRef,
    nombaAccountId: virtualAccount.accountId,
    healthScore: 92,
    healthScoreUpdatedAt: now(),
    isActive: true,
    memberCount: 0,
    balance: 0,
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
    cooperativeId: state.cooperatives[0].id,
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

export function getFirstCooperativeId() {
  return state.cooperatives[0].id;
}

export function getStateSnapshot() {
  return state;
}
