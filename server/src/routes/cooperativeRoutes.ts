import { Router } from 'express';
import { addCooperativeMemberController, createCooperativeController, getCooperativeController, getTrustScoreController } from '../controllers/cooperativeController';
import { requireAuth, requireRoles } from '../middleware/authMiddleware';

export const cooperativeRoutes = Router();

cooperativeRoutes.post('/', requireAuth, requireRoles('admin'), createCooperativeController);
cooperativeRoutes.post('/:id/members', requireAuth, requireRoles('admin'), addCooperativeMemberController);
cooperativeRoutes.get('/:id', getCooperativeController);
cooperativeRoutes.get('/:id/trust-score', getTrustScoreController);
