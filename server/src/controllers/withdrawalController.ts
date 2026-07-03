import type { Request, Response } from 'express';
import { createWithdrawalRequestData, getWithdrawalData, listWithdrawalsData, releaseWithdrawalData, signWithdrawalData } from '../services/repository';
import { explainWithdrawalRisk } from '../services/riskScoring';
import { lookupBankAccount } from '../services/nombaService';

export async function listWithdrawalsController(_req: Request, res: Response) {
  return res.json({ queue: await listWithdrawalsData() });
}

export async function getWithdrawalController(req: Request, res: Response) {
  const withdrawal = await getWithdrawalData(req.params.id);
  if (!withdrawal) return res.status(404).json({ message: 'Withdrawal item not found' });
  return res.json(withdrawal);
}

export async function requestWithdrawalController(req: Request, res: Response) {
  const { cooperativeId, requestedBy, amount, destinationAccount, destinationBankCode, purpose } = req.body ?? {};
  if (!cooperativeId || !requestedBy || !amount || !destinationAccount || !destinationBankCode || !purpose) {
    return res.status(400).json({
      message: 'cooperativeId, requestedBy, amount, destinationAccount, destinationBankCode, and purpose are required',
    });
  }

  const verification = await lookupBankAccount({
    accountNumber: String(destinationAccount),
    bankCode: String(destinationBankCode),
  });

  const result = await createWithdrawalRequestData({
    cooperativeId: String(cooperativeId),
    requestedBy: String(requestedBy),
    amount: Number(amount),
    destinationAccount: String(destinationAccount),
    destinationBankCode: String(destinationBankCode),
    purpose: String(purpose),
    destinationVerified: verification.verified,
  });

  return res.status(201).json({
    withdrawalId: result.withdrawal.id,
    ...result.result,
    status: result.withdrawal.status,
    explanations: result.withdrawal.explanations,
    destinationAccountName: verification.accountName ?? null,
  });
}

export async function signWithdrawalController(req: Request, res: Response) {
  const { memberId, role } = req.body ?? {};
  if (!memberId || !role) return res.status(400).json({ message: 'memberId and role are required' });

  const result = await signWithdrawalData(req.params.id, {
    memberId: String(memberId),
    role: role as 'treasurer' | 'executive1' | 'executive2',
  });

  if (!result) return res.status(404).json({ message: 'Withdrawal item not found' });
  return res.json({
    withdrawalId: result.withdrawal.id,
    signatureCount: result.withdrawal.signatureCount,
    status: result.withdrawal.status,
  });
}

export async function releaseWithdrawalController(req: Request, res: Response) {
  const withdrawal = await releaseWithdrawalData(req.params.id);
  if (!withdrawal) return res.status(404).json({ message: 'Withdrawal item not found' });

  return res.json({
    withdrawalId: withdrawal.id,
    transferRef: withdrawal.nombaTransferRef,
    status: withdrawal.status,
    provider: 'nomba-mock',
  });
}

export function withdrawalRiskPreviewController(req: Request, res: Response) {
  const { amount, average30d, signatureCount, destinationVerified, bvnDuplicate, purpose } = req.body ?? {};
  return res.json(
    explainWithdrawalRisk({
      amount: Number(amount || 0),
      average30d: Number(average30d || 1),
      signatureCount: Number(signatureCount || 0),
      destinationVerified: Boolean(destinationVerified ?? true),
      bvnDuplicate: Boolean(bvnDuplicate),
      purpose: String(purpose || ''),
    }),
  );
}
