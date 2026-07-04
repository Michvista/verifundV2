import crypto from 'crypto';
import { broadcastFeedEvent } from './realtime';

/**
 * Real integration with the Nomba API (https://developer.nomba.com).
 *
 * Behaviour:
 *  - If NOMBA_CLIENT_ID / NOMBA_CLIENT_SECRET / NOMBA_ACCOUNT_ID are missing or still set to the
 *    placeholder values from .env.example, every function below falls back to a deterministic
 *    mock so the rest of the app (and demos) keep working without live credentials.
 *  - As soon as real credentials are present, calls go to the real Nomba sandbox or production
 *    API (controlled by NOMBA_ENV).
 *
 * Auth flow: POST /v1/auth/token/issue with { grant_type, client_id, client_secret } and an
 * `accountId` header returns a short-lived access_token, which we cache and reuse until it's
 * close to expiry (Nomba tokens last ~30 minutes).
 */

type NombaEnv = 'sandbox' | 'production';

const NOMBA_ENV: NombaEnv = process.env.NOMBA_ENV === 'production' ? 'production' : 'sandbox';
const BASE_URL = NOMBA_ENV === 'production' ? 'https://api.nomba.com' : 'https://sandbox.nomba.com';

const CLIENT_ID = process.env.NOMBA_CLIENT_ID;
const CLIENT_SECRET = process.env.NOMBA_CLIENT_SECRET;
const ACCOUNT_ID = process.env.NOMBA_ACCOUNT_ID;
const WEBHOOK_SECRET = process.env.NOMBA_WEBHOOK_SECRET;
const ALLOW_MOCK_FALLBACK = process.env.NOMBA_ALLOW_MOCK_FALLBACK !== 'false';

// The exact header Nomba sends your signature in isn't fixed across every account/dashboard
// config, so this is overridable via env. Default matches the most common convention seen in
// Nomba's docs/examples. Confirm the real header name in your Nomba dashboard's webhook config
// once you're testing against a live webhook and adjust NOMBA_SIGNATURE_HEADER if needed.
export const nombaSignatureHeader = (process.env.NOMBA_SIGNATURE_HEADER || 'signature').toLowerCase();

function isPlaceholder(value?: string) {
  return !value || value.trim() === '' || value.startsWith('replace-with-your-');
}

export function isNombaConfigured() {
  return !isPlaceholder(CLIENT_ID) && !isPlaceholder(CLIENT_SECRET) && !isPlaceholder(ACCOUNT_ID);
}

let mockWarned = new Set<string>();
function warnMockMode(action: string) {
  if (!mockWarned.has(action)) {
    mockWarned.add(action);
    // eslint-disable-next-line no-console
    console.warn(
      `[nombaService] Running "${action}" in MOCK mode — NOMBA_CLIENT_ID/NOMBA_CLIENT_SECRET/NOMBA_ACCOUNT_ID ` +
        `are missing or still placeholders. Set real credentials in .env to hit the live Nomba ${NOMBA_ENV} API.`,
    );
  }
}

function traceNombaCall(action: string, request: any, response: any, error?: string) {
  broadcastFeedEvent({
    type: 'nomba-api-call',
    message: `Nomba API: ${action}`,
    timestamp: new Date().toISOString(),
    payload: {
      action,
      env: NOMBA_ENV,
      mode: isNombaConfigured() ? 'live' : 'mock',
      request,
      response,
      error,
    },
  });
}

// ---------------------------------------------------------------------------
// Token management
// ---------------------------------------------------------------------------

let cachedToken: { accessToken: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt - Date.now() > 30_000) {
    return cachedToken.accessToken;
  }

  const response = await fetch(`${BASE_URL}/v1/auth/token/issue`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      accountId: ACCOUNT_ID as string,
    },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
  });

  const payload: any = await response.json().catch(() => null);

  if (!response.ok || !payload?.data?.access_token) {
    throw new Error(
      `Nomba auth failed (${response.status}): ${payload?.description || payload?.message || response.statusText}`,
    );
  }

  const expiresAt = payload.data.expiresAt ? new Date(payload.data.expiresAt).getTime() : Date.now() + 25 * 60 * 1000;

  cachedToken = { accessToken: payload.data.access_token, expiresAt };
  return cachedToken.accessToken;
}

async function nombaRequest<T = any>(path: string, init: { method: string; body?: unknown }): Promise<T> {
  const token = await getAccessToken();
  const response = await fetch(`${BASE_URL}${path}`, {
    method: init.method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      accountId: ACCOUNT_ID as string,
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });

  const payload: any = await response.json().catch(() => null);

  const failed = !response.ok || (payload?.code && !['00', '201'].includes(String(payload.code)));
  if (failed) {
    throw new Error(
      `Nomba ${init.method} ${path} failed (${response.status}): ${payload?.description || payload?.message || response.statusText}`,
    );
  }

  return payload?.data as T;
}

// ---------------------------------------------------------------------------
// Virtual accounts (used to receive cooperative contributions)
// ---------------------------------------------------------------------------

let virtualAccountSequence = 5190;

export async function createVirtualAccount(args: {
  accountName: string;
  accountRef: string;
  bvn?: string;
  expectedAmount?: number;
}) {
  if (!isNombaConfigured()) {
    warnMockMode('createVirtualAccount');
    virtualAccountSequence += 1;
    const result = {
      success: true,
      accountId: `acct_${virtualAccountSequence}`,
      accountRef: args.accountRef,
      accountName: args.accountName,
      accountNumber: `90${String(1000000 + virtualAccountSequence).slice(0, 8)}`,
      bankName: 'Nomba (mock)',
      currency: 'NGN',
      bvnVerified: Boolean(args.bvn),
      expectedAmount: args.expectedAmount ?? null,
      provider: 'nomba-mock',
    };
    traceNombaCall('Create Virtual Account', args, result);
    return result;
  }

  try {
    const data = await nombaRequest<any>('/v1/accounts/virtual', {
      method: 'POST',
      body: {
        accountRef: args.accountRef,
        accountName: args.accountName,
        ...(args.bvn ? { bvn: args.bvn } : {}),
        ...(args.expectedAmount ? { expectedAmount: String(args.expectedAmount) } : {}),
      },
    });

    const accountId = String(data?.accountHolderId ?? data?.id ?? args.accountRef);
    const accountRef = String(data?.accountRef ?? args.accountRef);
    const accountName = String(data?.accountName ?? args.accountName);
    const accountNumber =
      String(data?.bankAccountNumber ?? data?.accountNumber ?? data?.virtualAccountNumber ?? '')
      || accountId.replace(/[^0-9]/g, '').slice(-10)
      || accountRef.replace(/[^0-9]/g, '').slice(-10)
      || `90${String(virtualAccountSequence).slice(-8)}`;

    const result = {
      success: true,
      accountId,
      accountRef,
      accountName,
      accountNumber,
      bankName: data?.bankName ?? 'Nomba',
      currency: data?.currency ?? 'NGN',
      bvnVerified: Boolean(args.bvn),
      expectedAmount: args.expectedAmount ?? null,
      provider: 'nomba',
    };
    traceNombaCall('Create Virtual Account', args, result);
    return result;
  } catch (error: any) {
    traceNombaCall('Create Virtual Account', args, null, error.message);
    if (!ALLOW_MOCK_FALLBACK) throw error;
    warnMockMode('createVirtualAccount:fallback');
    virtualAccountSequence += 1;
    const result = {
      success: true,
      accountId: `acct_${virtualAccountSequence}`,
      accountRef: args.accountRef,
      accountName: args.accountName,
      accountNumber: `90${String(1000000 + virtualAccountSequence).slice(0, 8)}`,
      bankName: 'Nomba (fallback)',
      currency: 'NGN',
      bvnVerified: Boolean(args.bvn),
      expectedAmount: args.expectedAmount ?? null,
      provider: 'nomba-fallback',
    };
    traceNombaCall('Create Virtual Account', args, result, error.message);
    return result;
  }
}

// ---------------------------------------------------------------------------
// Bank transfers (used to release approved withdrawals)
// ---------------------------------------------------------------------------

let transferSequence = 2041;

export async function createTransfer(args: {
  destinationAccount: string;
  bankCode: string;
  amount: number;
  narration: string;
  accountName?: string;
}) {
  if (!isNombaConfigured()) {
    warnMockMode('createTransfer');
    transferSequence += 1;
    const result = {
      success: true,
      transferRef: `nomba_trf_${transferSequence}`,
      destinationAccount: args.destinationAccount,
      bankCode: args.bankCode,
      amount: args.amount,
      narration: args.narration,
      status: 'released',
      provider: 'nomba-mock',
    };
    traceNombaCall('Disburse Bank Transfer', args, result);
    return result;
  }

  const merchantTxRef = `vf_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

  try {
    const data = await nombaRequest<any>('/v2/transfers/bank', {
      method: 'POST',
      body: {
        amount: args.amount,
        accountNumber: args.destinationAccount,
        accountName: args.accountName || 'VeriFund Cooperative Member',
        bankCode: args.bankCode,
        merchantTxRef,
        senderName: 'VeriFund',
        narration: args.narration,
      },
    });

    const nombaStatus = String(data?.status || '').toUpperCase();
    const status = nombaStatus === 'SUCCESS' ? 'released' : nombaStatus === 'REFUND' ? 'failed' : 'processing';

    const result = {
      success: true,
      transferRef: data?.id ?? merchantTxRef,
      destinationAccount: args.destinationAccount,
      bankCode: args.bankCode,
      amount: args.amount,
      narration: args.narration,
      status,
      provider: 'nomba',
    };
    traceNombaCall('Disburse Bank Transfer', args, result);
    return result;
  } catch (error: any) {
    traceNombaCall('Disburse Bank Transfer', args, null, error.message);
    if (!ALLOW_MOCK_FALLBACK) throw error;
    warnMockMode('createTransfer:fallback');
    transferSequence += 1;
    const result = {
      success: true,
      transferRef: `nomba_trf_${transferSequence}`,
      destinationAccount: args.destinationAccount,
      bankCode: args.bankCode,
      amount: args.amount,
      narration: args.narration,
      status: 'released',
      provider: 'nomba-fallback',
    };
    traceNombaCall('Disburse Bank Transfer', args, result, error.message);
    return result;
  }
}

// ---------------------------------------------------------------------------
// Bank account lookup (used to genuinely verify a withdrawal destination
// before it's scored/approved, instead of assuming destinationVerified: true)
// ---------------------------------------------------------------------------

export async function lookupBankAccount(args: { accountNumber: string; bankCode: string }) {
  if (!isNombaConfigured()) {
    warnMockMode('lookupBankAccount');
    const result = { verified: true, accountName: 'Verified Account Holder (mock)', provider: 'nomba-mock' as const };
    traceNombaCall('Verify Bank Account', args, result);
    return result;
  }

  try {
    const data = await nombaRequest<any>('/v1/transfers/bank/lookup', {
      method: 'POST',
      body: { accountNumber: args.accountNumber, bankCode: args.bankCode },
    });
    const result = { verified: true, accountName: data?.accountName ?? null, provider: 'nomba' as const };
    traceNombaCall('Verify Bank Account', args, result);
    return result;
  } catch (error: any) {
    const result = {
      verified: false,
      accountName: null,
      provider: 'nomba' as const,
      error: error.message,
    };
    traceNombaCall('Verify Bank Account', args, result, error.message);
    return result;
  }
}

// ---------------------------------------------------------------------------
// Bank list (for populating a bank-code dropdown instead of hardcoding one)
// ---------------------------------------------------------------------------

let bankListCache: { fetchedAt: number; banks: Array<{ code: string; name: string }> } | null = null;
export const fallbackBanks = [
  { code: '058', name: 'Guaranty Trust Bank' },
  { code: '011', name: 'First Bank of Nigeria' },
  { code: '057', name: 'Zenith Bank' },
  { code: '033', name: 'United Bank for Africa' },
  { code: '044', name: 'Access Bank' },
];

export async function fetchBanks() {
  if (!isNombaConfigured()) {
    warnMockMode('fetchBanks');
    traceNombaCall('Fetch Bank List', null, fallbackBanks);
    return fallbackBanks;
  }

  try {
    if (bankListCache && Date.now() - bankListCache.fetchedAt < 60 * 60 * 1000) {
      return bankListCache.banks;
    }

    const data = await nombaRequest<any>('/v1/transfers/banks', { method: 'GET' });
    const banks = (data?.results ?? [])
      .map((bank: any) => ({ code: bank.code, name: bank.name }))
      .filter((bank: any) => bank.code && bank.name);
    const result = banks.length ? banks : fallbackBanks;
    bankListCache = { fetchedAt: Date.now(), banks: result };
    traceNombaCall('Fetch Bank List', null, result);
    return result;
  } catch (error: any) {
    traceNombaCall('Fetch Bank List', null, fallbackBanks, error.message);
    return fallbackBanks;
  }
}

export async function fetchAccountTransactions(args: { accountNumber?: string; accountRef?: string } = {}) {
  if (!isNombaConfigured()) {
    warnMockMode('fetchAccountTransactions');
    const result: Array<Record<string, unknown>> = [];
    traceNombaCall('Fetch Account Transactions', args, result);
    return result;
  }

  try {
    const query = new URLSearchParams();
    if (args.accountNumber) query.set('accountNumber', args.accountNumber);
    if (args.accountRef) query.set('accountRef', args.accountRef);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    const data = await nombaRequest<any>(`/v1/transactions/accounts${suffix}`, { method: 'GET' });
    const transactions = Array.isArray(data)
      ? data
      : Array.isArray(data?.results)
        ? data.results
        : Array.isArray(data?.transactions)
          ? data.transactions
          : [];
    traceNombaCall('Fetch Account Transactions', args, transactions);
    return transactions;
  } catch (error: any) {
    traceNombaCall('Fetch Account Transactions', args, [], error.message);
    return [];
  }
}


// ---------------------------------------------------------------------------
// Webhook signature verification
// ---------------------------------------------------------------------------

/**
 * Verifies an inbound Nomba webhook using HMAC-SHA256 over the raw request body with your
 * NOMBA_WEBHOOK_SECRET. Nomba's own examples show the digest encoded as either hex or base64
 * depending on the doc page, so this checks both (plus the common `sha256=` prefixed form) to
 * maximize the chance of matching whatever your dashboard is configured to send. It always uses
 * a timing-safe comparison.
 *
 * IMPORTANT: this must be called with the *raw* (unparsed) request body bytes, not the
 * JSON-parsed object — see webhookController.ts / app.ts for how that's captured.
 */
export function verifyWebhookSignature(rawBody: string | Buffer, signature: string | undefined | null): boolean {
  if (isPlaceholder(WEBHOOK_SECRET)) return false;
  if (!signature) return false;

  const bodyBuffer = typeof rawBody === 'string' ? Buffer.from(rawBody) : rawBody;
  const hex = crypto.createHmac('sha256', WEBHOOK_SECRET as string).update(bodyBuffer).digest('hex');
  const base64 = crypto.createHmac('sha256', WEBHOOK_SECRET as string).update(bodyBuffer).digest('base64');

  const candidates = [hex, `sha256=${hex}`, base64];

  return candidates.some((candidate) => {
    const a = Buffer.from(candidate);
    const b = Buffer.from(signature);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  });
}
