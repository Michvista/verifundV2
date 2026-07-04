import type { Request, Response } from 'express';
import { getNombaCronStatus, queueTestCredit, runNombaCreditSync } from '../services/nombaCron';

export async function nombaCronStatusController(_req: Request, res: Response) {
  return res.json(getNombaCronStatus());
}

export async function nombaCronRunController(req: Request, res: Response) {
  const trigger = String(req.body?.trigger || 'manual') as 'manual' | 'test';
  const summary = await runNombaCreditSync(trigger === 'test' ? 'test' : 'manual');
  return res.json(summary);
}

export async function nombaCronQueueTestCreditController(req: Request, res: Response) {
  const { cooperativeId, amount, nombaTransactionRef } = req.body ?? {};
  if (!cooperativeId || !amount) {
    return res.status(400).json({ message: 'cooperativeId and amount are required' });
  }

  const credit = await queueTestCredit({
    cooperativeId: String(cooperativeId),
    amount: Number(amount),
    nombaTransactionRef: nombaTransactionRef ? String(nombaTransactionRef) : undefined,
  });

  return res.status(201).json({
    queued: true,
    credit,
    note: 'Run the cron sync route to post this credit into the treasury balance.',
  });
}
