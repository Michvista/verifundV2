import { useEffect, useState } from 'react';
import {
  getNombaCronStatus,
  queueTestNombaCredit,
  runNombaCron,
  type NombaCronStatus,
} from '../services/api';

type Props = {
  cooperativeId: string;
  onStatusChange?: (status: NombaCronStatus | null) => void;
  onSynced?: () => void | Promise<void>;
};

function formatSyncTime(value?: string) {
  if (!value) return 'Not yet run';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleTimeString();
}

export function NombaOperationsPanel({ cooperativeId, onStatusChange, onSynced }: Props) {
  const [status, setStatus] = useState<NombaCronStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [amount, setAmount] = useState('25000');
  const [reference, setReference] = useState('');

  async function loadStatus() {
    setStatusLoading(true);
    try {
      const nextStatus = await getNombaCronStatus();
      setStatus(nextStatus);
      onStatusChange?.(nextStatus);
    } catch {
      setStatus(null);
      onStatusChange?.(null);
    } finally {
      setStatusLoading(false);
    }
  }

  useEffect(() => {
    void loadStatus();
  }, [cooperativeId]);

  async function handleQueueTestCredit() {
    if (!cooperativeId) {
      setMessage('Select a cooperative before queueing a test credit.');
      return;
    }

    const parsedAmount = Number(amount.replace(/[^0-9]/g, '') || 0);
    if (!parsedAmount) {
      setMessage('Enter a test amount before queueing a credit.');
      return;
    }

    setActionLoading(true);
    setMessage(null);
    try {
      const queued = await queueTestNombaCredit({
        cooperativeId,
        amount: parsedAmount,
        nombaTransactionRef: reference.trim() || undefined,
      });
      setMessage(`Queued test credit ${queued.credit.nombaTransactionRef}. Run sync to apply it.`);
      await loadStatus();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Test credit could not be queued.');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRunSync() {
    setActionLoading(true);
    setMessage(null);
    try {
      const result = await runNombaCron('manual');
      setMessage(`Sync complete: ${result.processedCredits} credit(s) processed from ${result.source}.`);
      await loadStatus();
      await onSynced?.();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Nomba sync could not be completed.');
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <section className="deposit-panel page-reveal">
      <div className="eyebrow">Cron Sync</div>
      <h2>Reconcile incoming money</h2>
      <p>
        Transfer real NGN to the cooperative virtual account, then use this panel to inspect
        and run the Nomba-backed credit sync.
      </p>

      <div className="detail-grid" style={{ marginTop: 12 }}>
        <div>
          <span>Cron Status</span>
          <strong>{statusLoading ? 'Checking...' : status?.running ? 'Running' : status ? 'Idle' : 'Unavailable'}</strong>
        </div>
        <div>
          <span>Last Sync</span>
          <strong>{formatSyncTime(status?.lastRunAt)}</strong>
        </div>
        <div>
          <span>Pending Credits</span>
          <strong>{status?.pendingCredits ?? 0}</strong>
        </div>
        <div>
          <span>Nomba Connected</span>
          <strong>{status?.nombaConfigured ? 'Live' : 'Mock or fallback'}</strong>
        </div>
      </div>

      {message && <div className="notice" style={{ marginTop: 12 }}>{message}</div>}

      <label className="input-block">
        <span>Test Credit Amount (NGN)</span>
        <input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="numeric" />
      </label>

      <label className="input-block">
        <span>Optional Reference</span>
        <input
          value={reference}
          onChange={(event) => setReference(event.target.value)}
          placeholder="Leave blank to auto-generate"
        />
      </label>

      <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
        <button
          className="button button--primary button--full"
          disabled={actionLoading || !cooperativeId}
          onClick={() => void handleQueueTestCredit()}
        >
          {actionLoading ? 'Working...' : 'Queue Test Credit'}
        </button>
        <button
          className="button button--ghost button--full"
          disabled={actionLoading}
          onClick={() => void handleRunSync()}
        >
          {actionLoading ? 'Working...' : 'Run Cron Sync Now'}
        </button>
      </div>
    </section>
  );
}
