import type { RiskCategory } from '../types';

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export interface WithdrawalRiskInput {
  amount: number;
  average30d: number;
  signatureCount: number;
  destinationVerified: boolean;
  bvnDuplicate?: boolean;
  purpose?: string;
}

export interface ContributionRiskInput {
  amount: number;
  expectedAmount?: number;
  historyCount?: number;
  duplicateBvn?: boolean;
}

export function scoreWithdrawal(input: WithdrawalRiskInput) {
  const amount = Number(input.amount || 0);
  const average30d = Number(input.average30d || 1);
  const signatureCount = Number(input.signatureCount || 0);
  const destinationVerified = input.destinationVerified !== false;
  const bvnDuplicate = Boolean(input.bvnDuplicate);
  const purpose = String(input.purpose || '').toLowerCase();

  const ratio = amount / average30d;
  const zScore = average30d > 0 ? (amount - average30d) / Math.max(Math.sqrt(average30d), 1) : amount / 100000;
  const reasons: string[] = [];
  const signals = {
    ratio,
    zScore,
    signatureCount,
    destinationVerified,
    bvnDuplicate,
  };

  let score = 0.18;

  if (ratio > 4) {
    score += 0.42;
    reasons.push(`Amount is ${ratio.toFixed(1)}x the rolling 30-day average`);
  } else if (ratio > 2) {
    score += 0.24;
    reasons.push(`Amount is ${ratio.toFixed(1)}x the rolling 30-day average`);
  }

  if (signatureCount < 2 && amount > 1000000) {
    score += 0.22;
    reasons.push('Withdrawal is missing the minimum approval threshold');
  }

  if (!destinationVerified) {
    score += 0.16;
    reasons.push('Destination account has not been verified');
  }

  if (bvnDuplicate) {
    score += 0.25;
    reasons.push('A duplicate BVN signal was detected across member records');
  }

  if (purpose.includes('refund') || purpose.includes('cash')) {
    score += 0.08;
    reasons.push('Purpose text contains a higher-risk keyword pattern');
  }

  if (zScore > 1500) {
    score += 0.08;
    reasons.push('Withdrawal variance is significantly above the recent baseline');
  }

  const riskScore = clamp(Number(score.toFixed(3)), 0, 1);
  const riskCategory: RiskCategory = riskScore >= 0.75 ? 'high' : riskScore >= 0.45 ? 'medium' : 'low';

  return {
    riskScore,
    riskCategory,
    reasons,
    signals,
  };
}

export function scoreContribution(input: ContributionRiskInput) {
  const amount = Number(input.amount || 0);
  const expected = Number(input.expectedAmount || 20000);
  const historyCount = Number(input.historyCount || 0);
  const duplicateBvn = Boolean(input.duplicateBvn);

  let score = 0.08;
  const reasons: string[] = [];

  if (Math.abs(amount - expected) > expected * 0.25) {
    score += 0.18;
    reasons.push('Contribution amount deviates from the normal expected amount');
  }

  if (historyCount < 3) {
    score += 0.09;
    reasons.push('Low history count means this cooperative is still in a cold-start mode');
  }

  if (duplicateBvn) {
    score += 0.2;
    reasons.push('BVN reuse detected during onboarding');
  }

  return {
    riskScore: clamp(Number(score.toFixed(3)), 0, 1),
    riskCategory: (score >= 0.45 ? 'medium' : 'low') as RiskCategory,
    reasons,
  };
}

export function deriveHealthScore(baseScore: number, alertRiskScores: Array<{ riskScore: number }>) {
  const penalty = alertRiskScores.reduce((total, alert) => total + Math.min(alert.riskScore * 18, 18), 0);
  return clamp(Math.round(baseScore - penalty), 0, 100);
}

export function explainWithdrawalRisk(input: WithdrawalRiskInput) {
  const result = scoreWithdrawal(input);
  return {
    ...result,
    explanation: result.reasons.length
      ? result.reasons
      : ['The withdrawal sits within the cooperative’s normal operating range'],
  };
}
