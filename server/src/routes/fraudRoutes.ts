import { Router } from 'express';
import { getAlertController, listAlertsController, listAuditLogController, reportWhistleblowerController } from '../controllers/fraudController';
import { requireAuth, requireRoles } from '../middleware/authMiddleware';

export const fraudRoutes = Router();

fraudRoutes.get('/alerts', requireAuth, requireRoles('admin', 'regulator'), listAlertsController);
fraudRoutes.get('/alerts/:id', requireAuth, requireRoles('admin', 'regulator'), getAlertController);
fraudRoutes.get('/audit/log/:cooperativeId', requireAuth, requireRoles('admin', 'regulator'), listAuditLogController);
fraudRoutes.post('/whistleblower/report', reportWhistleblowerController);
