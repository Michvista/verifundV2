import { Router } from 'express';
import { loginController, myCooperativesController, registerController } from '../controllers/authController';
import { requireAuth } from '../middleware/authMiddleware';

export const authRoutes = Router();

authRoutes.post('/register', registerController);
authRoutes.post('/login', loginController);
authRoutes.get('/me/cooperatives', requireAuth, myCooperativesController);
