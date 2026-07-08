import { broadcastFeedEvent } from './realtime';
import { fetchAccountTransactions, isNombaConfigured } from './nombaService';
import {
  enqueueTreasuryCredit,
  listPendingTreasuryCredits,
  removePendingTreasuryCredit,
} from './store';
import { listTreasuryCooperativesData, recordTreasuryCreditData } from './repository';

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
    // IMPORTANT: on /v1/transactions/virtual responses, `accountNumber` is the SENDER's
    // account, not the virtual account being credited. `recipientAccountNumber` is the
    // field that actually identifies the destination virtual account. Using
    // `accountNumber` here was the root cause of crediting other people's transactions
    // to this cooperative.
    const accountNumber = String(
      entry.recipientAccountNumber ?? entry.destinationAccount ?? entry.virtualAccountNumber ?? '',
    );
    const direction = String(entry.direction ?? entry.entryType ?? entry.transactionType ?? entry.type ?? '').toLowerCase();
    const status = String(entry.status ?? entry.transactionStatus ?? '').toUpperCase();
    const type = String(entry.type ?? '').toLowerCase();

    return {
      amount,
      reference,
      accountNumber,
      direction,
      status,
      type,
      raw: entry,
    };
  });
}

function isCreditTransaction(item: ReturnType<typeof normalizeTransactions>[number]) {
  if (!item.amount || item.amount <= 0) return false;
  // Require this to actually be a virtual-account transfer, not just any
  // transaction that happens to carry a "credit"-ish direction/status.
  if (item.type && item.type !== 'vact_transfer') return false;
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
    void runNombaCreditSync('scheduled').catch((error) => {
      // Defense in depth: runNombaCreditSync shouldn't throw (fetchAccountTransactions
      // no longer throws), but if something unexpected does, never let it kill the
      // interval or crash the process — just log and let the next tick try again.
      console.error('=== NOMBA CRON TICK FAILED (non-fatal) ===');
      console.error(error);
    });
  }, DEFAULT_INTERVAL_MS);
  void runNombaCreditSync('scheduled').catch((error) => {
    console.error('=== NOMBA CRON INITIAL RUN FAILED (non-fatal) ===');
    console.error(error);
  });
}

export function stopNombaCron() {
  if (!intervalHandle) return;
  clearInterval(intervalHandle);
  intervalHandle = null;
}

export async function runNombaCreditSync(trigger: PollResult['trigger'] = 'manual') {
  const pendingBefore = listPendingTreasuryCredits().length;
  const queuedCredits: Array<{ id: string; cooperativeId: string; nombaTransactionRef: string }> = [];

  for (const credit of [...listPendingTreasuryCredits()]) {
    try {
      const result = await recordTreasuryCreditData({
        cooperativeId: credit.cooperativeId,
        amount: credit.amount,
        nombaTransactionRef: credit.nombaTransactionRef,
        source: credit.source,
      });
      if (result.processed) {
        queuedCredits.push({
          id: credit.id,
          cooperativeId: credit.cooperativeId,
          nombaTransactionRef: credit.nombaTransactionRef,
        });
        removePendingTreasuryCredit(credit.id);
      }
    } catch (error) {
      // One bad queued credit shouldn't block the rest of the queue or the poll run.
      console.error('=== FAILED TO PROCESS QUEUED CREDIT (non-fatal) ===', credit.id, error);
    }
  }

  let scannedTransactions = 0;
  let processedCredits = queuedCredits.length;
  let matchedCooperatives = 0;

  const cooperatives = await listTreasuryCooperativesData();

  if (isNombaConfigured() && cooperatives.length) {
    for (const cooperative of cooperatives) {
      try {
        // fetchAccountTransactions never throws — it resolves to [] on failure —
        // but this try/catch also guards recordTreasuryCreditData below so one
        // cooperative's bad data can't stop the rest of the sweep.
        const transactions = await fetchAccountTransactions({
          accountNumber: cooperative.nombaVirtualAccountNumber,
          accountRef: cooperative.nombaVirtualAccountRef,
        });
        const normalized = normalizeTransactions(transactions as Array<Record<string, unknown>>);
        scannedTransactions += normalized.length;

        for (const tx of normalized) {
          if (!isCreditTransaction(tx) || !tx.reference) continue;
          // Strict match only. A missing recipient account number must NOT pass —
          // that "trust it if we can't check it" fallback is what let unrelated
          // transactions get credited to this cooperative before.
          const destinationMatches =
            Boolean(cooperative.nombaVirtualAccountNumber) &&
            Boolean(tx.accountNumber) &&
            tx.accountNumber === cooperative.nombaVirtualAccountNumber;
          if (!destinationMatches) continue;

          matchedCooperatives += 1;
          const result = await recordTreasuryCreditData({
            cooperativeId: cooperative.id,
            amount: tx.amount,
            nombaTransactionRef: tx.reference,
            source: 'nomba-poll',
          });
          if (result.processed) {
            processedCredits += 1;
          }
        }
      } catch (error) {
        console.error('=== COOPERATIVE POLL FAILED (non-fatal) ===', cooperative.id, error);
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
