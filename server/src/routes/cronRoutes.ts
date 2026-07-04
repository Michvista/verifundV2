import { Router } from 'express';
import {
  nombaCronQueueTestCreditController,
  nombaCronRunController,
  nombaCronStatusController,
} from '../controllers/cronController';

export const cronRoutes = Router();

cronRoutes.get('/nomba/status', nombaCronStatusController);
cronRoutes.post('/nomba/run', nombaCronRunController);
cronRoutes.post('/nomba/test-credit', nombaCronQueueTestCreditController);
