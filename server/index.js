import express from 'express';
import cors from 'cors';
import { alerts, cooperatives, dashboard, withdrawalQueue } from './data.js';
import { createTransfer, createVirtualAccount, verifyWebhookSignature } from './nombaService.js';
import { deriveHealthScore, scoreContribution, scoreWithdrawal } from './riskScoring.js';

const app = express();
const port = process.env.PORT || 5050;

app.use(cors({ origin: true }));
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'verifund-api', mode: 'mock', time: new Date().toISOString() });
});

app.get('/api/dashboard', (_req, res) => {
  res.json({ ...dashboard, cooperativeId: cooperatives[0].id, healthScore: cooperatives[0].healthScore });
});

app.get('/api/cooperatives/:id', (req, res) => {
  const cooperative = cooperatives.find((item) => item.id === req.params.id) || cooperatives[0];
  res.json({
    ...cooperative,
    trustHistory: [42, 46, 50, 53, 58, 61, 70, 73, 72, 75, 78, 79],
    scoreBreakdown: [
      { label: 'Member Verification', value: 95 },
      { label: 'Contribution Regularity', value: 88 },
      { label: 'Loan Liquidity', value: 91 },
      { label: 'Governance Transparency', value: 100 },
      { label: 'External Audit Status', value: 85 },
    ],
  });
});

app.get('/api/cooperative/:id', (req, res) => {
  const cooperative = cooperatives.find((item) => item.id === req.params.id) || cooperatives[0];
  res.json(cooperative);
});

app.get('/api/trust-score/:id', (req, res) => {
  const cooperative = cooperatives.find((item) => item.id === req.params.id) || cooperatives[0];
  res.json({
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
    history: [42, 46, 50, 53, 58, 61, 70, 73, 72, 75, 78, 79],
  });
});

app.get('/api/cooperative/:id/trust-score', (req, res) => {
  const cooperative = cooperatives.find((item) => item.id === req.params.id) || cooperatives[0];
  res.json({
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
    history: [42, 46, 50, 53, 58, 61, 70, 73, 72, 75, 78, 79],
  });
});

app.get('/api/fraud-alerts', (_req, res) => {
  res.json({ alerts });
});

app.get('/api/fraud/alerts', (_req, res) => {
  res.json({ alerts });
});

app.get('/api/fraud-alerts/:id', (req, res) => {
  const alert = alerts.find((item) => item.id === req.params.id);
  if (!alert) {
    return res.status(404).json({ message: 'Alert not found' });
  }
  res.json(alert);
});

app.get('/api/withdrawals', (_req, res) => {
  res.json({ queue: withdrawalQueue });
});

app.get('/api/withdrawals/:id', (req, res) => {
  const item = withdrawalQueue.find((entry) => entry.id === req.params.id);
  if (!item) {
    return res.status(404).json({ message: 'Withdrawal item not found' });
  }
  res.json(item);
});

app.get('/api/risk/:cooperativeId', (req, res) => {
  const cooperative = cooperatives.find((item) => item.id === req.params.cooperativeId) || cooperatives[0];
  const latest = withdrawalQueue[0];
  const result = scoreWithdrawal({
    amount: latest.amount,
    average30d: latest.average30d,
    signatureCount: latest.signatureCount,
    purpose: latest.purpose,
    destinationVerified: true,
  });

  res.json({
    cooperativeId: cooperative.id,
    riskScore: result.riskScore,
    riskCategory: result.riskCategory,
    reasons: result.reasons,
    healthScore: deriveHealthScore(cooperative.healthScore, alerts),
  });
});

app.post('/api/contribution', (req, res) => {
  const result = scoreContribution(req.body || {});
  res.status(201).json({
    contributionRef: `txn_${Date.now()}`,
    status: result.riskScore > 0.45 ? 'flagged' : 'confirmed',
    ...result,
  });
});

app.post('/api/withdrawals/request', (req, res) => {
  const result = scoreWithdrawal(req.body || {});
  res.status(201).json({
    withdrawalId: `wf_${Date.now()}`,
    ...result,
    status: result.riskCategory === 'high' ? 'pending_review' : 'pending',
  });
});

app.post('/api/withdrawal/request', (req, res) => {
  const result = scoreWithdrawal(req.body || {});
  res.status(201).json({
    withdrawalId: `wf_${Date.now()}`,
    ...result,
    status: result.riskCategory === 'high' ? 'pending_review' : 'pending',
  });
});

app.post('/api/withdrawals/:id/sign', (req, res) => {
  res.json({
    withdrawalId: req.params.id,
    signatureCount: Number(req.body?.signatureCount || 0) + 1,
    status: 'partially_signed',
  });
});

app.post('/api/withdrawals/:id/release', (req, res) => {
  const payload = createTransfer({
    destinationAccount: req.body?.destinationAccount || '0000000000',
    bankCode: req.body?.bankCode || '000',
    amount: Number(req.body?.amount || 0),
    narration: req.body?.narration || 'VeriFund cooperative disbursement',
  });
  res.json(payload);
});

app.post('/api/cooperatives/:id/virtual-account', (req, res) => {
  const cooperative = cooperatives.find((item) => item.id === req.params.id) || cooperatives[0];
  const payload = createVirtualAccount({
    accountName: cooperative.name,
    accountRef: `va_${cooperative.id}`,
    bvn: req.body?.bvn,
    expectedAmount: req.body?.expectedAmount,
  });
  res.status(201).json(payload);
});

app.post('/api/webhooks/nomba', (req, res) => {
  const signature = req.header('x-nomba-signature') || '';
  if (!verifyWebhookSignature(signature)) {
    return res.status(401).json({ ok: false, message: 'Invalid webhook signature' });
  }

  const risk = scoreContribution({
    amount: Number(req.body?.amount || 0),
    expectedAmount: req.body?.expectedAmount || 20000,
    duplicateBvn: req.body?.duplicateBvn,
    historyCount: req.body?.historyCount || 0,
  });

  res.json({
    ok: true,
    received: true,
    riskScore: risk.riskScore,
    riskCategory: risk.riskCategory,
    reasons: risk.reasons,
    eventType: req.body?.eventType || 'transaction',
  });
});

app.listen(port, () => {
  console.log(`VeriFund mock API listening on http://localhost:${port}`);
});
