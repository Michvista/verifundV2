import { prisma, usingDatabase } from "./db";
import {
  createCooperative,
  assignMemberToCooperative,
  createMember,
  createWebhookAudit,
  getAlert,
  getCooperativeOverview,
  getDashboard,
  getFirstCooperativeId,
  getMemberOrThrow,
  getStateSnapshot,
  getTrustScore,
  getWithdrawal,
  listAlerts,
  listAuditLog,
  listWithdrawals,
  recordContribution,
  recalculateHealthScore,
  releaseWithdrawal,
  reportWhistleblower,
  signWithdrawal,
  verifyMemberByBvnHash,
  createWithdrawalRequest,
  listMemberCooperatives,
} from "./store";
import { createVirtualAccount, createTransfer } from "./nombaService";
import { scoreContribution, scoreWithdrawal } from "./riskScoring";
import type { Cooperative } from "../types";
import { broadcastFeedEvent } from "./realtime";
import { formatContributionAmount, getDefaultContributionAmount } from "./contributionSettings";

const emptyDashboard = {
  balance: 0,
  nextContribution: "No active cooperative",
  tenure: "0 Months Active",
  trustScore: 0,
  loanStatus: "Unavailable",
  activityFeed: [],
  contributionTrend: [],
  contributionHistory: [],
};

const emptyTrustScore = {
  id: "",
  name: "No cooperative selected",
  score: 0,
  summary: "Create a cooperative to generate a live trust score.",
  scoreBreakdown: [],
  history: [],
};

export async function getDashboardData(
  cooperativeId = getFirstCooperativeId(),
) {
  if (!usingDatabase) return getDashboard(cooperativeId);

  const cooperative = await prisma.cooperative.findUnique({
    where: { id: cooperativeId },
    include: {
      contributions: { orderBy: { contributedAt: "desc" }, take: 4 },
    },
  });

  const base =
    cooperative ??
    (await prisma.cooperative.findFirst({ include: { contributions: true } }));
  if (!base) return getDashboard(cooperativeId);
  const nextContribution = formatContributionAmount(base.contributionAmount || getDefaultContributionAmount());

  return {
    balance: base.balance || 0,
    nextContribution,
    tenure: "14 Months Active",
    trustScore: base.healthScore,
    loanStatus: "Eligible",
    activityFeed: getDashboard(cooperativeId).activityFeed,
    contributionTrend: getDashboard(cooperativeId).contributionTrend,
    contributionHistory: getDashboard(cooperativeId).contributionHistory,
    cooperativeId: base.id,
    healthScore: base.healthScore,
  };
}

export async function getCooperativeData(cooperativeId: string) {
  if (!usingDatabase) return getCooperativeOverview(cooperativeId);
  const cooperative = await prisma.cooperative.findUnique({
    where: { id: cooperativeId },
  });
  if (!cooperative) return getCooperativeOverview(cooperativeId);

  return {
    ...cooperative,
    trustHistory: getTrustScore(cooperativeId).history,
    scoreBreakdown: getTrustScore(cooperativeId).scoreBreakdown,
  };
}

export async function getTrustScoreData(cooperativeId: string) {
  if (!usingDatabase) return getTrustScore(cooperativeId);
  const cooperative = await prisma.cooperative.findUnique({
    where: { id: cooperativeId },
  });
  if (!cooperative) return getTrustScore(cooperativeId);
  return {
    id: cooperative.id,
    name: cooperative.name,
    score: cooperative.healthScore,
    summary:
      "This cooperative maintains a 98% timely contribution rate and has no outstanding dispute records.",
    scoreBreakdown: [
      { label: "Member Verification", value: 95 },
      { label: "Contribution Regularity", value: 88 },
      { label: "Loan Liquidity", value: 91 },
      { label: "Governance Transparency", value: 100 },
      { label: "External Audit Status", value: 85 },
    ],
    history: [42, 46, 50, 53, 58, 61, 70, 73, 72, 75, 78, 79],
  };
}

export async function listFraudAlertsData() {
  if (!usingDatabase) return listAlerts();
  const alerts = await prisma.fraudAlert.findMany({
    orderBy: { createdAt: "desc" },
  });
  return alerts;
}

export async function getFraudAlertData(alertId: string) {
  if (!usingDatabase) return getAlert(alertId);
  return prisma.fraudAlert.findUnique({ where: { id: alertId } });
}

export async function listWithdrawalsData() {
  if (!usingDatabase) return listWithdrawals();
  return prisma.withdrawalRequest.findMany({ orderBy: { createdAt: "desc" } });
}

export async function getWithdrawalData(withdrawalId: string) {
  if (!usingDatabase) return getWithdrawal(withdrawalId);
  return prisma.withdrawalRequest.findUnique({ where: { id: withdrawalId } });
}

export async function listAuditLogData(cooperativeId: string) {
  if (!usingDatabase) return listAuditLog(cooperativeId);
  return prisma.auditEvent.findMany({
    where: { cooperativeId },
    orderBy: { createdAt: "desc" },
  });
}

export async function registerMember(input: {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  bvnHash: string;
  role?: "member" | "treasurer" | "executive1" | "executive2" | "admin" | "regulator";
}) {
  if (!usingDatabase) {
    const verification = verifyMemberByBvnHash(input.bvnHash);
    const member = createMember(input);
    return {
      member,
      verification: {
        verified: verification.verified,
        duplicateCount: verification.duplicateCount,
        bvnNameMatch: verification.verified,
        details: { duplicateCount: verification.duplicateCount },
      },
      nomba: {
        accountCreated: true,
        virtualAccountCreated: verification.verified,
        accountRef: `va_${member.id}`,
      },
    };
  }

  const existing = await prisma.member.findMany({
    where: { bvnHash: input.bvnHash },
  });
  let member;
  try {
    member = await prisma.member.create({
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        phoneNumber: input.phoneNumber,
        bvnHash: input.bvnHash,
        bvnVerified: existing.length === 0,
        bvnVerifiedAt: existing.length === 0 ? new Date() : null,
        role: input.role || "member",
        isActive: true,
      },
    });
  } catch (err) {
    // Handle race condition where another request inserted the same BVN concurrently.
    const e = err as any;
    if (e?.code === "P2002") {
      const existingMember = await prisma.member.findFirst({
        where: { bvnHash: input.bvnHash },
      });
      if (existingMember) {
        return {
          member: existingMember,
          verification: {
            verified: false,
            duplicateCount: 1,
            bvnNameMatch: false,
            details: { duplicateDetected: true },
          },
          nomba: {
            accountCreated: false,
            virtualAccountCreated: false,
            accountRef: `va_${existingMember.id}`,
          },
        };
      }
    }
    throw err;
  }

  return {
    member,
    verification: {
      verified: existing.length === 0,
      duplicateCount: existing.length,
      bvnNameMatch: existing.length === 0,
      details: { duplicateCount: existing.length },
    },
    nomba: {
      accountCreated: true,
      virtualAccountCreated: existing.length === 0,
      accountRef: `va_${member.id}`,
    },
  };
}

export async function loginMember(memberId: string) {
  if (!usingDatabase) return getMemberOrThrow(memberId);
  const member = await prisma.member.findUnique({ where: { id: memberId } });
  if (!member) throw new Error(`Member ${memberId} not found`);
  return member;
}

export async function getMemberCooperativesData(memberId: string) {
  if (!usingDatabase) return listMemberCooperatives(memberId);

  const memberships = await prisma.cooperativeMember.findMany({
    where: { memberId },
    include: { cooperative: true },
  });
  const created = await prisma.cooperative.findMany({
    where: { createdByMemberId: memberId },
  });
  const seen = new Set<string>();
  return [
    ...memberships.map((membership) => {
      seen.add(membership.cooperativeId);
      return {
        id: membership.cooperative.id,
        name: membership.cooperative.name,
        registrationNumber: membership.cooperative.registrationNumber,
        role: membership.role,
        createdByMemberId: membership.cooperative.createdByMemberId,
      };
    }),
    ...created
      .filter((coop) => !seen.has(coop.id))
      .map((coop) => ({
        id: coop.id,
        name: coop.name,
        registrationNumber: coop.registrationNumber,
        role: 'admin',
        createdByMemberId: coop.createdByMemberId,
      })),
  ];
}

export async function createCooperativeData(input: {
  name: string;
  registrationNumber: string;
  stateName: string;
  cooperativeType: Cooperative["cooperativeType"];
  bvn?: string;
  contributionAmount?: number;
  createdByMemberId?: string;
}) {
  if (!usingDatabase) return await createCooperative(input as any);

  // accountRef must be 16–64 chars per Nomba's requirements.
  const rawRef = `va_${input.registrationNumber}`;
  const accountRef = rawRef.length >= 16 ? rawRef : `${rawRef}_${Date.now()}`.slice(0, 64);

  const virtualAccount = await createVirtualAccount({
    accountName: input.name,
    accountRef,
    bvn: input.bvn,
    // No expectedAmount — accept any inbound transfer amount
  });

  const cooperative = await prisma.cooperative.create({
    data: {
      id: input.registrationNumber.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      name: input.name,
      registrationNumber: input.registrationNumber,
      state: input.stateName,
      cooperativeType: input.cooperativeType,
      createdByMemberId: input.createdByMemberId || null,
      contributionAmount: Number(input.contributionAmount || getDefaultContributionAmount()),
      nombaVirtualAccountRef: virtualAccount.accountRef,
      nombaAccountId: virtualAccount.accountId,
      nombaVirtualAccountNumber: virtualAccount.accountNumber,
      healthScore: 0,
      isActive: true,
      memberCount: 0,
      balance: 0,
    },
  });

  if (input.createdByMemberId) {
    await prisma.cooperativeMember.upsert({
      where: {
        cooperativeId_memberId: {
          cooperativeId: cooperative.id,
          memberId: input.createdByMemberId,
        },
      },
      update: { role: 'admin' },
      create: {
        cooperativeId: cooperative.id,
        memberId: input.createdByMemberId,
        role: 'admin',
      },
    });
  }

  return { cooperative, virtualAccount };
}

export async function assignMemberToCooperativeData(input: {
  cooperativeId: string;
  memberId: string;
  role: 'member' | 'treasurer' | 'executive1' | 'executive2' | 'admin';
}) {
  if (!usingDatabase) return assignMemberToCooperative(input);

  const membership = await prisma.cooperativeMember.upsert({
    where: {
      cooperativeId_memberId: {
        cooperativeId: input.cooperativeId,
        memberId: input.memberId,
      },
    },
    update: { role: input.role },
    create: {
      cooperativeId: input.cooperativeId,
      memberId: input.memberId,
      role: input.role,
    },
  });

  const memberCount = await prisma.cooperativeMember.count({
    where: { cooperativeId: input.cooperativeId },
  });

  await prisma.cooperative.update({
    where: { id: input.cooperativeId },
    data: { memberCount },
  });

  return membership;
}

export async function createContributionData(input: {
  memberId: string;
  cooperativeId: string;
  amount: number;
  expectedAmount?: number;
  duplicateBvn?: boolean;
}) {
  const result = scoreContribution(input);
  if (!usingDatabase) return recordContribution(input);

  const contribution = await prisma.contribution.create({
    data: {
      memberId: input.memberId,
      cooperativeId: input.cooperativeId,
      amount: input.amount,
      nombaTransactionRef: `txn_${Date.now()}`,
      status: result.riskScore > 0.45 ? "flagged" : "confirmed",
      riskScore: result.riskScore,
      contributedAt: new Date(),
    },
  });

  await prisma.cooperative.update({
    where: { id: input.cooperativeId },
    data: { balance: { increment: input.amount } },
  });

  broadcastFeedEvent({
    type: "contribution",
    message: "New contribution recorded",
    timestamp: new Date().toISOString(),
    payload: {
      contributionId: contribution.id,
      cooperativeId: input.cooperativeId,
      riskScore: result.riskScore,
    },
  });

  await prisma.auditEvent.create({
    data: {
      cooperativeId: input.cooperativeId,
      eventType: "contribution_recorded",
      description:
        "Contribution ingested and scored by the VeriFund risk engine.",
      metadata: {
        contributionId: contribution.id,
        reasons: result.reasons,
        riskCategory: result.riskCategory,
      },
    },
  });

  return { contribution, result };
}

export async function createWithdrawalRequestData(input: {
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

  if (!usingDatabase) return createWithdrawalRequest(input as any);

  const withdrawal = await prisma.withdrawalRequest.create({
    data: {
      cooperativeId: input.cooperativeId,
      requestedById: input.requestedBy,
      amount: input.amount,
      destinationAccount: input.destinationAccount,
      destinationBankCode: input.destinationBankCode,
      purpose: input.purpose,
      riskScore: result.riskScore,
      status: result.riskCategory === "high" ? "pending_review" : "pending",
      average30d: 510000,
      signatureCount: 1,
      explanations: result.reasons,
    },
  });

  broadcastFeedEvent({
    type: "withdrawal",
    message: "Withdrawal request created",
    timestamp: new Date().toISOString(),
    payload: {
      withdrawalId: withdrawal.id,
      riskScore: result.riskScore,
      category: result.riskCategory,
    },
  });

  await prisma.fraudAlert.create({
    data: {
      cooperativeId: input.cooperativeId,
      alertType: "anomaly",
      riskScore: result.riskScore,
      triggeredBy: "withdrawal_risk_engine",
      evidenceJson: { ...result.signals, amount: input.amount },
      status: "open",
      title: "Withdrawal risk evaluated",
      reason: result.reasons[0] || "Automated withdrawal review completed.",
      severity:
        result.riskCategory === "high"
          ? "High"
          : result.riskCategory === "medium"
            ? "Medium"
            : "Low",
    },
  });

  return { withdrawal, result };
}

export async function signWithdrawalData(
  withdrawalId: string,
  signer: { memberId: string; role: "treasurer" | "executive1" | "executive2" },
) {
  if (!usingDatabase) return signWithdrawal(withdrawalId, signer);

  const signature = await prisma.withdrawalSignature.create({
    data: {
      withdrawalRequestId: withdrawalId,
      signedById: signer.memberId,
      role: signer.role,
      signedAt: new Date(),
    },
  });

  const current = await prisma.withdrawalRequest.findUnique({
    where: { id: withdrawalId },
  });
  if (!current) return undefined;
  const nextCount = current.signatureCount + 1;
  const updated = await prisma.withdrawalRequest.update({
    where: { id: withdrawalId },
    data: {
      signatureCount: nextCount,
      status: nextCount >= 3 ? "approved" : "partially_signed",
    },
  });

  broadcastFeedEvent({
    type: "withdrawal-signature",
    message: "Withdrawal signed",
    timestamp: new Date().toISOString(),
    payload: {
      withdrawalId,
      signatureCount: updated.signatureCount,
      role: signer.role,
    },
  });

  return { withdrawal: updated, signature };
}

export async function releaseWithdrawalData(withdrawalId: string) {
  if (!usingDatabase) return await releaseWithdrawal(withdrawalId);

  const withdrawal = await prisma.withdrawalRequest.findUnique({
    where: { id: withdrawalId },
  });
  if (!withdrawal) return undefined;

  const transfer = await createTransfer({
    destinationAccount: withdrawal.destinationAccount,
    bankCode: withdrawal.destinationBankCode,
    amount: withdrawal.amount,
    narration: withdrawal.purpose,
  });

  const updated = await prisma.withdrawalRequest.update({
    where: { id: withdrawalId },
    data: { status: "released", nombaTransferRef: transfer.transferRef },
  });

  broadcastFeedEvent({
    type: "withdrawal-release",
    message: "Withdrawal released",
    timestamp: new Date().toISOString(),
    payload: { withdrawalId, transferRef: transfer.transferRef },
  });

  return { withdrawal: updated, transfer };
}

export async function reportWhistleblowerData(input: {
  report: string;
  supportingDetails?: string;
}) {
  if (!usingDatabase) return reportWhistleblower(input);

  const cooperativeId = getFirstCooperativeId();
  const report = await prisma.whistleblowerReport.create({
    data: {
      cooperativeId,
      report: input.report,
      supportingDetails: input.supportingDetails,
      status: "open",
    },
  });

  const alert = await prisma.fraudAlert.create({
    data: {
      cooperativeId,
      alertType: "whistleblower",
      riskScore: 0.5,
      triggeredBy: "whistleblower_triage",
      evidenceJson: { report },
      status: "open",
      title: "Anonymous whistleblower report received",
      reason: input.report.slice(0, 160),
      severity: "Medium",
    },
  });

  broadcastFeedEvent({
    type: "whistleblower",
    message: "Whistleblower report received",
    timestamp: new Date().toISOString(),
    payload: { reportId: report.id, alertType: alert.alertType },
  });

  return { report, alert };
}

export async function createWebhookAuditData(input: {
  cooperativeId: string;
  eventType: string;
  description: string;
  metadata?: Record<string, unknown>;
}) {
  if (!usingDatabase) return createWebhookAudit(input);

  return prisma.auditEvent.create({
    data: {
      cooperativeId: input.cooperativeId,
      eventType: input.eventType,
      description: input.description,
      metadata: input.metadata ?? {},
    },
  });
}

export async function recalculateHealthScoreData(cooperativeId: string) {
  if (!usingDatabase) return recalculateHealthScore(cooperativeId);

  const alerts = await prisma.fraudAlert.findMany({ where: { cooperativeId } });
  const cooperative = await prisma.cooperative.findUnique({
    where: { id: cooperativeId },
  });
  if (!cooperative) return 0;
  const score = Math.max(
    0,
    Math.round(
      cooperative.healthScore -
        alerts.reduce(
          (total, alert) => total + Math.min(Number(alert.riskScore) * 18, 18),
          0,
        ),
    ),
  );
  await prisma.cooperative.update({
    where: { id: cooperativeId },
    data: { healthScore: score },
  });
  return score;
}

export async function getMemberOrThrowData(memberId: string) {
  if (!usingDatabase) return getMemberOrThrow(memberId);
  const member = await prisma.member.findUnique({ where: { id: memberId } });
  if (!member) throw new Error(`Member ${memberId} not found`);
  return member;
}

export async function verifyMemberByBvnHashData(bvnHash: string) {
  if (!usingDatabase) return verifyMemberByBvnHash(bvnHash);
  const existing = await prisma.member.findMany({ where: { bvnHash } });
  return { verified: existing.length <= 1, duplicateCount: existing.length };
}

export async function getFirstCooperativeIdData() {
  if (!usingDatabase) return getFirstCooperativeId();
  const cooperative = await prisma.cooperative.findFirst();
  return cooperative?.id ?? getFirstCooperativeId();
}

export async function getStateSnapshotData() {
  if (!usingDatabase) return getStateSnapshot();
  return {
    cooperatives: await prisma.cooperative.count(),
    members: await prisma.member.count(),
    contributions: await prisma.contribution.count(),
    withdrawals: await prisma.withdrawalRequest.count(),
    alerts: await prisma.fraudAlert.count(),
    reports: await prisma.whistleblowerReport.count(),
  };
}
