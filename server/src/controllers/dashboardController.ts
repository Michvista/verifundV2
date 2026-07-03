import type { Request, Response } from 'express';
import { getDashboardData } from '../services/repository';

export async function getDashboardController(req: Request, res: Response) {
  const cooperativeId = String(req.query.cooperativeId || 'okafor-farmers-thrift');
  res.json(await getDashboardData(cooperativeId));
}
