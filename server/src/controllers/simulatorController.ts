import type { Request, Response } from 'express';
import crypto from 'crypto';

export async function simulateWebhookController(req: Request, res: Response) {
  const { cooperativeId, memberId, amount, expectedAmount, duplicateBvn, historyCount } = req.body ?? {};

  if (!cooperativeId || !amount) {
    return res.status(400).json({ message: 'cooperativeId and amount are required' });
  }

  const payload = {
    cooperativeId: String(cooperativeId),
    memberId: memberId ? String(memberId) : undefined,
    amount: Number(amount),
    expectedAmount: Number(expectedAmount || 20000),
    duplicateBvn: Boolean(duplicateBvn),
    historyCount: Number(historyCount || 0),
    eventType: 'virtual_account_deposit',
    timestamp: new Date().toISOString(),
  };

  const secret = process.env.NOMBA_WEBHOOK_SECRET || 'jhgh';
  const bodyString = JSON.stringify(payload);

  let signature: string;
  const isPlaceholder = !secret || secret.trim() === '' || secret.startsWith('replace-with-your-');
  if (isPlaceholder) {
    signature = 'mock-signature-abc';
  } else {
    signature = crypto.createHmac('sha256', secret).update(bodyString).digest('hex');
  }

  const port = process.env.PORT || 5050;
  const signatureHeader = (process.env.NOMBA_SIGNATURE_HEADER || 'signature').toLowerCase();

  try {
    const response = await fetch(`http://localhost:${port}/api/webhooks/nomba`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [signatureHeader]: signature,
      },
      body: bodyString,
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        message: `Webhook simulation failed: ${response.statusText}`,
        details: data,
      });
    }

    return res.json({
      success: true,
      message: 'Webhook simulated and processed successfully',
      payload,
      signature,
      signatureHeader,
      response: data,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Failed to invoke webhook endpoint: ${(error as Error).message}`,
    });
  }
}
