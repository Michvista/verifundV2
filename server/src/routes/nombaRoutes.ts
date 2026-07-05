import { Router } from 'express';
import { fetchTransactionsController, listBanksController, verifyAccountController } from '../controllers/nombaController';
import { simulateWebhookController } from '../controllers/simulatorController';

export const nombaRoutes = Router();

nombaRoutes.get('/banks', listBanksController);
nombaRoutes.post('/verify-account', verifyAccountController);
nombaRoutes.post('/simulate-deposit', simulateWebhookController);
nombaRoutes.get('/transactions', fetchTransactionsController);
nombaRoutes.get('/transactions/:cooperativeId', fetchTransactionsController);
