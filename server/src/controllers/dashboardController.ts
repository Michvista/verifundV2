import type { Request, Response } from 'express';
import { getDashboardData } from '../services/repository';

export async function getDashboardController(req: Request, res: Response) {
  const cooperativeId = typeof req.query.cooperativeId === 'string' ? req.query.cooperativeId : undefined;
  res.json(await getDashboardData(cooperativeId));
}
