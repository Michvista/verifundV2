import type { Request, Response } from 'express';
import { signAuthToken } from '../services/auth';
import { getMemberOrThrowData, registerMember } from '../services/repository';

export async function registerController(req: Request, res: Response) {
  const { firstName, lastName, phoneNumber, bvnHash } = req.body ?? {};
  if (!firstName || !lastName || !phoneNumber || !bvnHash) {
    return res.status(400).json({ message: 'firstName, lastName, phoneNumber, and bvnHash are required' });
  }

  const { member, verification } = await registerMember({
    firstName: String(firstName),
    lastName: String(lastName),
    phoneNumber: String(phoneNumber),
    bvnHash: String(bvnHash),
  });

  return res.status(201).json({
    member,
    verification,
    nomba: {
      accountCreated: true,
      virtualAccountCreated: verification.verified,
      accountRef: `va_${member.id}`,
    },
  });
}

export async function loginController(req: Request, res: Response) {
  const { memberId } = req.body ?? {};
  if (!memberId) return res.status(400).json({ message: 'memberId is required' });

  const member = await getMemberOrThrowData(String(memberId));
  return res.json({
    token: signAuthToken(member),
    member: {
      id: member.id,
      firstName: member.firstName,
      lastName: member.lastName,
      role: member.role,
    },
  });
}
