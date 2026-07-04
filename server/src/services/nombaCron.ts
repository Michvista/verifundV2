import { broadcastFeedEvent } from './realtime';
import { fetchAccountTransactions, isNombaConfigured } from './nombaService';
import {
  enqueueTreasuryCredit,
  listCooperatives,
  listPendingTreasuryCredits,
  processPendingTreasuryCredits,
  recordTreasuryCredit,
} from './store';

type PollResult = {
  trigger: 'scheduled' | 'manual' | 'test';
  scannedTransactions: number;
  processedCredits: number;
  queuedCreditsProcessed: number;
  matchedCooperatives: number;
  pendingCredits: number;
  lastRunAt: string;
  source: string;
};

const DEFAULT_INTERVAL_MS = Number(process.env.NOMBA_POLL_INTERVAL_MS || 60_000);
let intervalHandle: NodeJS.Timeout | null = null;
let lastRunAt = '';

function now() {
  return new Date().toISOString();
}

function normalizeTransactions(payload: Array<Record<string, unknown>>) {
  return payload.map((entry) => {
    const amount = Number(
      entry.amount ?? entry.transactionAmount ?? entry.value ?? entry.creditAmount ?? 0,
    );
    const reference = String(
      entry.id ??
        entry.reference ??
        entry.transactionRef ??
        entry.transactionReference ??
        entry.merchantTxRef ??
        entry.ref ??
        '',
    );
    const accountNumber = String(
      entry.accountNumber ?? entry.destinationAccount ?? entry.virtualAccountNumber ?? entry.account ?? '',
    );
    const direction = String(entry.direction ?? entry.transactionType ?? entry.type ?? '').toLowerCase();
    const status = String(entry.status ?? entry.transactionStatus ?? '').toUpperCase();

    return {
      amount,
      reference,
      accountNumber,
      direction,
      status,
      raw: entry,
    };
  });
}

function isCreditTransaction(item: ReturnType<typeof normalizeTransactions>[number]) {
  if (!item.amount || item.amount <= 0) return false;
  const directionSignals = ['credit', 'cr', 'inbound', 'received'];
  const statusSignals = ['SUCCESS', 'SUCCESSFUL', 'COMPLETED', 'SETTLED'];
  return (
    directionSignals.some((signal) => item.direction.includes(signal)) ||
    statusSignals.includes(item.status)
  );
}

export function startNombaCron() {
  if (intervalHandle) return;
  intervalHandle = setInterval(() => {
    void runNombaCreditSync('scheduled');
  }, DEFAULT_INTERVAL_MS);
  void runNombaCreditSync('scheduled');
}

export function stopNombaCron() {
  if (!intervalHandle) return;
  clearInterval(intervalHandle);
  intervalHandle = null;
}

export async function runNombaCreditSync(trigger: PollResult['trigger'] = 'manual') {
  const pendingBefore = listPendingTreasuryCredits().length;
  const queuedCredits = processPendingTreasuryCredits();
  let scannedTransactions = 0;
  let processedCredits = queuedCredits.length;
  let matchedCooperatives = 0;

  const cooperatives = listCooperatives();

  if (isNombaConfigured() && cooperatives.length) {
    for (const cooperative of cooperatives) {
      const transactions = await fetchAccountTransactions({
        accountNumber: cooperative.nombaVirtualAccountNumber,
        accountRef: cooperative.nombaVirtualAccountRef,
      });
      const normalized = normalizeTransactions(transactions as Array<Record<string, unknown>>);
      scannedTransactions += normalized.length;

      for (const tx of normalized) {
        if (!isCreditTransaction(tx) || !tx.reference) continue;
        const destinationMatches =
          !cooperative.nombaVirtualAccountNumber || !tx.accountNumber
            ? true
            : tx.accountNumber === cooperative.nombaVirtualAccountNumber;
        if (!destinationMatches) continue;

        matchedCooperatives += 1;
        const result = recordTreasuryCredit({
          cooperativeId: cooperative.id,
          amount: tx.amount,
          nombaTransactionRef: tx.reference,
          source: 'nomba-poll',
        });
        if (result.processed) {
          processedCredits += 1;
        }
      }
    }
  }

  lastRunAt = now();
  const summary: PollResult = {
    trigger,
    scannedTransactions,
    processedCredits,
    queuedCreditsProcessed: queuedCredits.length,
    matchedCooperatives,
    pendingCredits: Math.max(pendingBefore - queuedCredits.length, 0),
    lastRunAt,
    source: isNombaConfigured() ? 'nomba' : 'local-queue',
  };

  broadcastFeedEvent({
    type: 'cron-nomba-sync',
    message: `Nomba credit sync ran (${trigger})`,
    timestamp: lastRunAt,
    payload: summary,
  });

  return summary;
}

export function getNombaCronStatus() {
  return {
    running: Boolean(intervalHandle),
    lastRunAt,
    pendingCredits: listPendingTreasuryCredits().length,
    pollIntervalMs: DEFAULT_INTERVAL_MS,
    nombaConfigured: isNombaConfigured(),
  };
}

export async function queueTestCredit(input: {
  cooperativeId: string;
  amount: number;
  nombaTransactionRef?: string;
}) {
  const credit = enqueueTreasuryCredit({
    cooperativeId: input.cooperativeId,
    amount: input.amount,
    nombaTransactionRef: input.nombaTransactionRef,
    source: 'manual-test',
  });
  return credit;
}
