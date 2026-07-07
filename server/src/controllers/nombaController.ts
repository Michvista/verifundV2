import type { Request, Response } from 'express';
import { fallbackBanks, fetchBanks, isNombaConfigured, lookupBankAccount } from '../services/nombaService';

export async function listBanksController(_req: Request, res: Response) {
  try {
    const banks = await fetchBanks();
    const mode = isNombaConfigured() ? (banks === fallbackBanks ? 'fallback' : 'live') : 'mock';
    return res.json({ banks, mode });
  } catch (error) {
    return res.status(502).json({ message: (error as Error).message });
  }
}

export async function verifyAccountController(req: Request, res: Response) {
  const { accountNumber, bankCode } = req.body ?? {};
  if (!accountNumber || !bankCode) {
    return res.status(400).json({ message: 'accountNumber and bankCode are required' });
  }

  const result = await lookupBankAccount({ accountNumber: String(accountNumber), bankCode: String(bankCode) });
  return res.json({ ...result, mode: isNombaConfigured() ? 'live' : 'mock' });
}
