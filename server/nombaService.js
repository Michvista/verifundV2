let transferSequence = 2041;
let virtualAccountSequence = 5190;

export function createVirtualAccount({ accountName, accountRef, bvn, expectedAmount }) {
  virtualAccountSequence += 1;
  return {
    success: true,
    accountId: `acct_${virtualAccountSequence}`,
    accountRef,
    accountName,
    currency: 'NGN',
    bvnVerified: Boolean(bvn),
    expectedAmount: expectedAmount || null,
    provider: 'nomba-mock',
  };
}

export function createTransfer({ destinationAccount, bankCode, amount, narration }) {
  transferSequence += 1;
  return {
    success: true,
    transferRef: `nomba_trf_${transferSequence}`,
    destinationAccount,
    bankCode,
    amount,
    narration,
    status: 'released',
    provider: 'nomba-mock',
  };
}

export function verifyWebhookSignature(signature) {
  return typeof signature === 'string' && signature.includes('mock');
}
