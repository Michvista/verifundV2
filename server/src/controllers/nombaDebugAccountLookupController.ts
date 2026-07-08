import type { Request, Response } from 'express';

/**
 * TEMPORARY DIAGNOSTIC ROUTE — remove after debugging.
 *
 * Wire up alongside nombaDebugSearchController:
 *   app.get('/api/debug/nomba-account-lookup', nombaDebugAccountLookupController);
 *
 * Then open in your phone browser:
 *   https://verifundv2.onrender.com/api/debug/nomba-account-lookup
 *
 * This independently asks Nomba "does virtual account 5187140495 actually exist,
 * and what is it?" — separate from searching transaction history. If this comes
 * back empty/404, the account number your app has stored may not match what
 * Nomba actually provisioned, which would explain everything.
 */
export async function nombaDebugAccountLookupController(req: Request, res: Response) {
  const virtualAcctNumber = String(req.query.accountNumber || '5187140495');

  try {
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

    const lookupResponse = await fetch(`${BASE_URL}/v1/accounts/virtual/${virtualAcctNumber}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        accountId: ACCOUNT_ID,
      },
    });
    const lookupPayload: any = await lookupResponse.json().catch(() => null);

    return res.json({
      ok: true,
      queriedAccountNumber: virtualAcctNumber,
      httpStatus: lookupResponse.status,
      accountExists: lookupResponse.ok && Boolean(lookupPayload?.data),
      accountDetails: lookupPayload?.data ?? null,
      rawResponse: lookupPayload,
    });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error.message });
  }
}
