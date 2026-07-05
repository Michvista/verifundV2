const DEFAULT_CONTRIBUTION_AMOUNT = 20000;

export function getDefaultContributionAmount() {
  const raw = Number(process.env.VERIFUND_DEFAULT_CONTRIBUTION_AMOUNT || DEFAULT_CONTRIBUTION_AMOUNT);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_CONTRIBUTION_AMOUNT;
}

export function formatContributionAmount(amount = getDefaultContributionAmount()) {
  return `Jan 15, ₦${amount.toLocaleString('en-NG')}`;
}
