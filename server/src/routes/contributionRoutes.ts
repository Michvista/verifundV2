import { Router } from 'express';
import { createContributionController } from '../controllers/contributionController';
import { requireAuth, requireRoles } from '../middleware/authMiddleware';

export const contributionRoutes = Router();

contributionRoutes.post('/', requireAuth, requireRoles('member', 'treasurer', 'admin'), createContributionController);
