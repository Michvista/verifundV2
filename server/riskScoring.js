const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export function scoreWithdrawal(input) {
  const amount = Number(input.amount || 0);
  const average30d = Number(input.average30d || 1);
  const signatureCount = Number(input.signatureCount || 0);
  const destinationVerified = input.destinationVerified !== false;
  const bvnDuplicate = Boolean(input.bvnDuplicate);
  const purpose = String(input.purpose || '').toLowerCase();

  const ratio = amount / average30d;
  const zScore = average30d > 0 ? (amount - average30d) / Math.max(Math.sqrt(average30d), 1) : amount / 100000;

  const reasons = [];
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
  const riskCategory = riskScore >= 0.75 ? 'high' : riskScore >= 0.45 ? 'medium' : 'low';

  return {
    riskScore,
    riskCategory,
    reasons,
    signals: {
      ratio,
      zScore,
      signatureCount,
      destinationVerified,
      bvnDuplicate,
    },
  };
}

export function scoreContribution(input) {
  const amount = Number(input.amount || 0);
  const expected = Number(input.expectedAmount || 20000);
  const historyCount = Number(input.historyCount || 0);
  const duplicateBvn = Boolean(input.duplicateBvn);

  let score = 0.08;
  const reasons = [];

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
    riskCategory: score >= 0.45 ? 'medium' : 'low',
    reasons,
  };
}

export function deriveHealthScore(baseScore, alerts = []) {
  const penalty = alerts.reduce((total, alert) => total + Math.min(alert.riskScore * 18, 18), 0);
  return clamp(Math.round(baseScore - penalty), 0, 100);
}
