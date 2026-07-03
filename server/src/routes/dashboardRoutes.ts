import { Router } from 'express';
import { getDashboardController } from '../controllers/dashboardController';

export const dashboardRoutes = Router();

dashboardRoutes.get('/', getDashboardController);
