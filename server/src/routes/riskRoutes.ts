import { Router } from 'express';
import { scoreContribution, scoreWithdrawal } from '../services/riskScoring';
import { getDefaultContributionAmount } from '../services/contributionSettings';

export const riskRoutes = Router();

riskRoutes.get('/:cooperativeId', (req, res) => {
  const withdrawalPreview = scoreWithdrawal({
    amount: 2450000,
    average30d: 510000,
    signatureCount: 1,
    destinationVerified: true,
    purpose: 'Equipment procurement for Q4 distribution run.',
  });

  res.json({
    cooperativeId: req.params.cooperativeId,
    riskScore: withdrawalPreview.riskScore,
    riskCategory: withdrawalPreview.riskCategory,
    reasons: withdrawalPreview.reasons,
    contributionSignal: scoreContribution({
      amount: getDefaultContributionAmount(),
      expectedAmount: getDefaultContributionAmount(),
      historyCount: 4,
    }),
  });
});
