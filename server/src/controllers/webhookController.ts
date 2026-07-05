import type { Request, Response } from 'express';
import { createWebhookAuditData, recalculateHealthScoreData } from '../services/repository';
import { getDefaultContributionAmount } from '../services/contributionSettings';
import { scoreContribution } from '../services/riskScoring';
import { nombaSignatureHeader, verifyWebhookSignature } from '../services/nombaService';
import { broadcastFeedEvent } from '../services/realtime';

export async function nombaWebhookController(req: Request, res: Response) {
  // Accept either the configured header name (NOMBA_SIGNATURE_HEADER, default "signature") or
  // the legacy "x-nomba-signature" header this endpoint used to check for.
  const signature = req.header(nombaSignatureHeader) || req.header('x-nomba-signature') || undefined;
  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));

  const verified = verifyWebhookSignature(rawBody, signature);

  broadcastFeedEvent({
    type: 'nomba-webhook',
    message: `Nomba Webhook: ${req.body?.eventType || 'transaction'}`,
    timestamp: new Date().toISOString(),
    payload: {
      headers: {
        signature,
        signatureHeaderName: nombaSignatureHeader,
        signatureHeaderValue: req.header(nombaSignatureHeader),
        legacySignatureValue: req.header('x-nomba-signature'),
      },
      body: req.body,
      verified,
    },
  });

  if (!verified) {
    return res.status(401).json({ ok: false, message: 'Invalid webhook signature' });
  }

  const cooperativeId = String(req.body?.cooperativeId || '');
  if (!cooperativeId) {
    return res.status(400).json({ ok: false, message: 'cooperativeId is required in the webhook payload' });
  }
  const contributionRisk = scoreContribution({
    amount: Number(req.body?.amount || 0),
    expectedAmount: Number(req.body?.expectedAmount || getDefaultContributionAmount()),
    duplicateBvn: Boolean(req.body?.duplicateBvn),
    historyCount: Number(req.body?.historyCount || 0),
  });

  await createWebhookAuditData({
    cooperativeId,
    eventType: req.body?.eventType || 'transaction',
    description: 'Nomba webhook received and scored.',
    metadata: { payload: req.body ?? {}, risk: contributionRisk },
  });

  const healthScore = await recalculateHealthScoreData(cooperativeId);

  return res.json({
    ok: true,
    received: true,
    riskScore: contributionRisk.riskScore,
    riskCategory: contributionRisk.riskCategory,
    reasons: contributionRisk.reasons,
    healthScore,
    eventType: req.body?.eventType || 'transaction',
  });
}
