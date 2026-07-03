import type { NextFunction, Request, Response } from 'express';
import { verifyAuthToken } from '../services/auth';

export type AuthenticatedRequest = Request & {
  user?: {
    id: string;
    role: string;
    firstName: string;
    lastName: string;
  };
};

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const header = req.header('authorization');
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Missing bearer token' });
  }

  try {
    const claims = verifyAuthToken(header.slice(7));
    req.user = {
      id: claims.sub,
      role: claims.role,
      firstName: claims.firstName,
      lastName: claims.lastName,
    };
    return next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

export function requireRoles(...roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Insufficient role' });
    }

    return next();
  };
}
