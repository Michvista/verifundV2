import { Router } from 'express';
import { nombaWebhookController } from '../controllers/webhookController';

export const webhookRoutes = Router();

webhookRoutes.post('/nomba', nombaWebhookController);
