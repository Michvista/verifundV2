import { Router } from 'express';
import {
  getWithdrawalController,
  listWithdrawalsController,
  releaseWithdrawalController,
  requestWithdrawalController,
  signWithdrawalController,
  withdrawalRiskPreviewController,
} from '../controllers/withdrawalController';
import { requireAuth, requireRoles } from '../middleware/authMiddleware';

export const withdrawalRoutes = Router();

withdrawalRoutes.get('/', requireAuth, requireRoles('admin', 'treasurer', 'executive1', 'executive2'), listWithdrawalsController);
withdrawalRoutes.post('/request', requireAuth, requireRoles('treasurer', 'admin'), requestWithdrawalController);
withdrawalRoutes.post('/request/preview', withdrawalRiskPreviewController);
withdrawalRoutes.get('/:id', getWithdrawalController);
withdrawalRoutes.post('/:id/sign', requireAuth, requireRoles('treasurer', 'executive1', 'executive2', 'admin'), signWithdrawalController);
withdrawalRoutes.post('/:id/release', requireAuth, requireRoles('admin', 'treasurer'), releaseWithdrawalController);
