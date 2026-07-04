import type { Request, Response } from 'express';
import { queueTestCredit, runNombaCreditSync } from '../services/nombaCron';

export async function simulateWebhookController(req: Request, res: Response) {
  const { cooperativeId, amount, nombaTransactionRef } = req.body ?? {};

  if (!cooperativeId || !amount) {
    return res.status(400).json({ message: 'cooperativeId and amount are required' });
  }

  const credit = await queueTestCredit({
    cooperativeId: String(cooperativeId),
    amount: Number(amount),
    nombaTransactionRef: nombaTransactionRef ? String(nombaTransactionRef) : undefined,
  });

  const pollResult = await runNombaCreditSync('test');

  return res.json({
    success: true,
    message: 'Test credit queued and processed by the cron sync path',
    credit,
    pollResult,
  });
}
