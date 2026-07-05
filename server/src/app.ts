import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { authRoutes } from './routes/authRoutes';
import { cronRoutes } from './routes/cronRoutes';
import { cooperativeRoutes } from './routes/cooperativeRoutes';
import { dashboardRoutes } from './routes/dashboardRoutes';
import { contributionRoutes } from './routes/contributionRoutes';
import { fraudRoutes } from './routes/fraudRoutes';
import { nombaRoutes } from './routes/nombaRoutes';
import { riskRoutes } from './routes/riskRoutes';
import { webhookRoutes } from './routes/webhookRoutes';
import { withdrawalRoutes } from './routes/withdrawalRoutes';
import { getFraudAlertData, getStateSnapshotData, getTrustScoreData, listFraudAlertsData } from './services/repository';
import { isNombaConfigured } from './services/nombaService';
import { usingDatabase } from './services/db';


export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: true }));
  // Capture the raw request body bytes alongside the parsed JSON. The Nomba webhook signature
  // must be computed over the exact raw bytes Nomba sent, not a re-serialized JSON.parse'd copy.
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        (req as express.Request & { rawBody?: Buffer }).rawBody = buf;
      },
    }),
  );
  app.use(morgan('dev'));

  app.get('/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'verifund-api',
      mode: 'monolith',
      nombaMode: isNombaConfigured() ? 'live' : 'mock',
      databaseMode: usingDatabase ? 'postgres' : 'memory',
      time: new Date().toISOString(),
    });
  });

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'verifund-api',
      mode: 'monolith',
      nombaMode: isNombaConfigured() ? 'live' : 'mock',
      databaseMode: usingDatabase ? 'postgres' : 'memory',
      time: new Date().toISOString(),
    });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/cron', cronRoutes);
  app.use('/api/cooperative', cooperativeRoutes);
  app.use('/api/cooperatives', cooperativeRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/contribution', contributionRoutes);
  app.use('/api/fraud', fraudRoutes);
  app.use('/api', fraudRoutes);
  app.use('/api/nomba', nombaRoutes);
  app.use('/api/risk', riskRoutes);
  app.use('/api/webhooks', webhookRoutes);
  app.use('/api/withdrawal', withdrawalRoutes);
  app.use('/api/withdrawals', withdrawalRoutes);

  app.get('/api/trust-score/:id', async (req, res) => {
    res.json(await getTrustScoreData(req.params.id));
  });

  app.get('/api/fraud-alerts', (_req, res) => {
    Promise.resolve(listFraudAlertsData()).then((alerts) => res.json({ alerts }));
  });

  app.get('/api/fraud-alerts/:id', (req, res) => {
    Promise.resolve(getFraudAlertData(req.params.id)).then((alert) => {
      if (!alert) {
        return res.status(404).json({ message: 'Alert not found' });
      }
      return res.json(alert);
    });
  });

  app.get('/api/state', (_req, res) => {
    Promise.resolve(getStateSnapshotData()).then((state) => res.json(state));
  });

  app.use((_req, res) => {
    res.status(404).json({ message: 'Route not found' });
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    // Avoid leaking stack traces in demo mode.
    res.status(500).json({ message: error?.message ?? 'Internal server error' });
  });

  return app;
}
