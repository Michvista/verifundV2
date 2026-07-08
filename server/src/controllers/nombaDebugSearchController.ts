import type { Request, Response } from 'express';

/**
 * TEMPORARY DIAGNOSTIC ROUTE — remove after debugging.
 *
 * Wire this up in your routes file, e.g.:
 *   app.get('/api/debug/nomba-search', nombaDebugSearchController);
 *
 * Then just open in your phone browser:
 *   https://<your-render-app>.onrender.com/api/debug/nomba-search
 *
 * It hits the UNSCOPED /v1/transactions/accounts endpoint (whole merchant account,
 * not filtered to your virtual account) purely to answer one question: does a ₦50
 * transaction exist ANYWHERE in the merchant's transaction history at all?
 *
 * If it shows up here with recipientAccountNumber "5187140495" → the money reached
 * the right account, but /v1/transactions/virtual just isn't indexing it (report
 * this to Nomba with the transactionId as evidence).
 *
 * If it does NOT show up here → the transfer either hasn't settled yet or went to
 * a different account number than expected.
 */
export async function nombaDebugSearchController(req: Request, res: Response) {
  try {
    // Re-implement a minimal authenticated GET here so this route has zero
    // dependency on the rest of nombaService's scoped logic — keeps the
    // diagnostic honest and independent of whatever bugs we're chasing there.
    const BASE_URL =
      process.env.NOMBA_ENV === 'production' ? 'https://api.nomba.com' : 'https://sandbox.nomba.com';
    const CLIENT_ID = process.env.NOMBA_CLIENT_ID as string;
    const CLIENT_SECRET = process.env.NOMBA_CLIENT_SECRET as string;
    const ACCOUNT_ID = process.env.NOMBA_ACCOUNT_ID as string;

    const tokenResponse = await fetch(`${BASE_URL}/v1/auth/token/issue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', accountId: ACCOUNT_ID },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
      }),
    });
    const tokenPayload: any = await tokenResponse.json().catch(() => null);
    const token = tokenPayload?.data?.access_token;

    if (!token) {
      return res.status(500).json({ ok: false, step: 'auth', tokenResponseStatus: tokenResponse.status, tokenPayload });
    }

    const limit = req.query.limit ? String(req.query.limit) : '50';
    const txResponse = await fetch(`${BASE_URL}/v1/transactions/accounts?limit=${limit}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        accountId: ACCOUNT_ID,
      },
    });
    const txPayload: any = await txResponse.json().catch(() => null);

    const results = Array.isArray(txPayload?.data?.results) ? txPayload.data.results : [];

    // Surface just the fields that matter for the ₦50 hunt, so this is readable
    // on a phone screen instead of a wall of raw JSON.
    const summary = results.map((entry: any) => ({
      id: entry.id,
      type: entry.type,
      entryType: entry.entryType,
      amount: entry.amount,
      accountNumber: entry.accountNumber,
      recipientAccountNumber: entry.recipientAccountNumber,
      status: entry.status,
      timeCreated: entry.timeCreated,
      narration: entry.narration,
      senderName: entry.senderName,
    }));

    const targetAccount = String(req.query.accountNumber || '5187140495');

    return res.json({
      ok: true,
      httpStatus: txResponse.status,
      totalResults: results.length,
      queriedAccountNumber: targetAccount,
      matchesYourVirtualAccount: summary.filter(
        (t: any) => t.accountNumber === targetAccount || t.recipientAccountNumber === targetAccount,
      ),
      allResults: summary,
    });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error.message });
  }
}
