import type { Request, Response } from 'express';
import { createCooperativeData, getCooperativeData, getTrustScoreData, assignMemberToCooperativeData } from '../services/repository';
import type { AuthenticatedRequest } from '../middleware/authMiddleware';

export async function createCooperativeController(req: AuthenticatedRequest, res: Response) {
  const { name, registrationNumber, stateName, cooperativeType, bvn, contributionAmount } = req.body ?? {};
  if (!name || !registrationNumber || !stateName || !cooperativeType || !bvn) {
    return res.status(400).json({ message: 'name, registrationNumber, stateName, cooperativeType, and bvn are required' });
  }

  try {
    const result = await createCooperativeData({
      name,
      registrationNumber,
      stateName,
      cooperativeType,
      bvn,
      contributionAmount: contributionAmount ? Number(contributionAmount) : undefined,
      createdByMemberId: req.user?.id,
    });
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

export async function addCooperativeMemberController(req: Request, res: Response) {
  const { memberId, role } = req.body ?? {};
  if (!memberId || !role) {
    return res.status(400).json({ message: 'memberId and role are required' });
  }

  try {
    const result = await assignMemberToCooperativeData({
      cooperativeId: req.params.id,
      memberId: String(memberId),
      role: role as 'member' | 'treasurer' | 'executive1' | 'executive2' | 'admin',
    });
    return res.status(201).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to add member';
    return res.status(400).json({ message });
  }
}
