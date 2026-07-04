import type { Request, Response } from 'express';
import { createContributionData } from '../services/repository';

export async function createContributionController(req: Request, res: Response) {
  const { memberId, cooperativeId, amount, expectedAmount, duplicateBvn } = req.body ?? {};
  if (!memberId || !cooperativeId || !amount) {
    return res.status(400).json({
      message: 'memberId, cooperativeId, and amount are required',
    });
  }

  const result = await createContributionData({
    memberId: String(memberId),
    cooperativeId: String(cooperativeId),
    amount: Number(amount),
    expectedAmount: expectedAmount ? Number(expectedAmount) : undefined,
    duplicateBvn: Boolean(duplicateBvn),
  });

  return res.status(201).json({
    contribution: result.contribution,
    result: result.result,
  });
}
