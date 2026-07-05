import type { Request, Response } from 'express';
import { fallbackBanks, fetchAccountTransactions, fetchBanks, isNombaConfigured, lookupBankAccount } from '../services/nombaService';
import { getCooperativeData } from '../services/repository';

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

export async function fetchTransactionsController(req: Request, res: Response) {
  const cooperativeId = String(req.query.cooperativeId || req.params.cooperativeId || '');
  if (!cooperativeId) {
    return res.status(400).json({ message: 'cooperativeId is required' });
  }

  const cooperative = await getCooperativeData(cooperativeId);
  if (!cooperative?.id) {
    return res.status(404).json({ message: 'Cooperative not found' });
  }

  const transactions = await fetchAccountTransactions({
    accountNumber: cooperative.nombaVirtualAccountNumber || undefined,
    accountRef: cooperative.nombaVirtualAccountRef || undefined,
  });

  return res.json({
    cooperativeId,
    accountNumber: cooperative.nombaVirtualAccountNumber || null,
    accountRef: cooperative.nombaVirtualAccountRef || null,
    provider: isNombaConfigured() ? 'nomba' : 'mock',
    count: transactions.length,
    transactions,
  });
}
