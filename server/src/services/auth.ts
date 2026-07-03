import jwt from 'jsonwebtoken';
import type { Member } from '../types';

type JwtClaims = {
  sub: string;
  role: string;
  firstName: string;
  lastName: string;
};

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }
  return secret;
}

export function signAuthToken(member: Pick<Member, 'id' | 'role' | 'firstName' | 'lastName'>) {
  const payload: JwtClaims = {
    sub: member.id,
    role: member.role,
    firstName: member.firstName,
    lastName: member.lastName,
  };

  return jwt.sign(payload, getSecret(), { expiresIn: '7d' });
}

export function verifyAuthToken(token: string) {
  return jwt.verify(token, getSecret()) as JwtClaims;
}
