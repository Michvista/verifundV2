import type { Request, Response } from 'express';
import { getFraudAlertData, listAuditLogData, listFraudAlertsData, reportWhistleblowerData } from '../services/repository';

export async function listAlertsController(_req: Request, res: Response) {
  return res.json({ alerts: await listFraudAlertsData() });
}

export async function getAlertController(req: Request, res: Response) {
  const alert = await getFraudAlertData(req.params.id);
  if (!alert) return res.status(404).json({ message: 'Alert not found' });
  return res.json(alert);
}

export async function listAuditLogController(req: Request, res: Response) {
  return res.json({ events: await listAuditLogData(req.params.cooperativeId) });
}

export async function reportWhistleblowerController(req: Request, res: Response) {
  const { report, supportingDetails } = req.body ?? {};
  if (!report) return res.status(400).json({ message: 'report is required' });
  const result = await reportWhistleblowerData({ report: String(report), supportingDetails: supportingDetails ? String(supportingDetails) : undefined });
  return res.status(201).json(result);
}
