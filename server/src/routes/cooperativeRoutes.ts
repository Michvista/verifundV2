import { Router } from 'express';
import { createCooperativeController, getCooperativeController, getTrustScoreController } from '../controllers/cooperativeController';
import { requireAuth, requireRoles } from '../middleware/authMiddleware';

export const cooperativeRoutes = Router();

cooperativeRoutes.post('/', requireAuth, requireRoles('admin'), createCooperativeController);
cooperativeRoutes.get('/:id', getCooperativeController);
cooperativeRoutes.get('/:id/trust-score', getTrustScoreController);
