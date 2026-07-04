import type { Request, Response } from 'express';
import { createCooperativeData, getCooperativeData, getTrustScoreData } from '../services/repository';

export async function createCooperativeController(req: Request, res: Response) {
  const { name, registrationNumber, stateName, cooperativeType, bvn } = req.body ?? {};
  if (!name || !registrationNumber || !stateName || !cooperativeType) {
    return res.status(400).json({ message: 'name, registrationNumber, stateName, and cooperativeType are required' });
  }

  try {
    const result = await createCooperativeData({ name, registrationNumber, stateName, cooperativeType, bvn });
    return res.status(201).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Cooperative creation failed';
    return res.status(502).json({ message: `Nomba virtual account creation failed: ${message}` });
  }
}

export async function getCooperativeController(req: Request, res: Response) {
  return res.json(await getCooperativeData(req.params.id));
}

export async function getTrustScoreController(req: Request, res: Response) {
  return res.json(await getTrustScoreData(req.params.id));
}
