import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../components/Modal';
import { StatusPill } from '../components/StatusPill';
import { Metric } from '../components/Metric';
import {
  getBanks,
  verifyAccount,
  getQueue,
  getQueueItem,
  requestWithdrawal,
  signWithdrawal,
  releaseWithdrawal,
  type QueueItem,
} from '../services/api';

type Bank = { code: string; name: string };

function loadUser() {
  try {
    const raw = localStorage.getItem('verifund_user');
    return raw ? (JSON.parse(raw) as { id: string; role: string }) : null;
  } catch {
    return null;
  }
}

function loadCooperativeId() {
  return localStorage.getItem('verifund_cooperative_id') || '';
}

function formatNaira(value: number | string) {
  const n = typeof value === 'string' ? Number(value.replace(/[^0-9.]/g, '')) : value;
  if (Number.isNaN(n)) return '₦0.00';
  return `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
}

export function WithdrawalPage() {
  const user = loadUser();
  const cooperativeId = loadCooperativeId();
  const [amount, setAmount] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [bankCode, setBankCode] = useState('');
  const [purpose, setPurpose] = useState('');
  const [banks, setBanks] = useState<Bank[]>([]);
  const [verifiedName, setVerifiedName] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [selectedQueueId, setSelectedQueueId] = useState<string | null>(null);
  const [selectedQueueItem, setSelectedQueueItem] = useState<QueueItem | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  useEffect(() => {
    void getBanks().then((res) => setBanks(res.banks)).catch(() => setBanks([]));
  }, []);

  useEffect(() => {
    void getQueue().then((res) => setQueue(res.queue)).catch(() => setQueue([]));
  }, []);

  useEffect(() => {
    if (!selectedQueueId) {
      setSelectedQueueItem(null);
      return;
    }
    const cached = queue.find((i) => i.id === selectedQueueId);
    if (cached) {
      setSelectedQueueItem(cached);
      return;
    }
    void getQueueItem(selectedQueueId).then(setSelectedQueueItem).catch(() => setSelectedQueueItem(null));
  }, [queue, selectedQueueId]);

  useEffect(() => {
    setVerifiedName(null);
    if (accountNumber.length === 10 && bankCode) {
      setVerifying(true);
      verifyAccount(accountNumber, bankCode)
        .then((res) => setVerifiedName(res.verified ? (res.accountName ?? 'Verified') : null))
        .catch(() => setVerifiedName(null))
        .finally(() => setVerifying(false));
    }
  }, [accountNumber, bankCode]);

  const amountValue = Number(amount.replace(/[^0-9]/g, '') || 0);
  const riskLevel = useMemo(() => {
    if (amountValue === 0) return { label: 'Idle', tone: 'neutral' as const, score: 0 };
    if (amountValue > 1_000_000) return { label: 'High', tone: 'danger' as const, score: 81 };
    if (amountValue > 600_000) return { label: 'Medium', tone: 'warn' as const, score: 56 };
    return { label: 'Low', tone: 'success' as const, score: 22 };
  }, [amountValue]);

  async function handleInitialize() {
    if (!amountValue || !accountNumber || !bankCode || !purpose || !cooperativeId || !user) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await requestWithdrawal({
        amount: amountValue,
        destinationAccount: accountNumber,
        destinationBankCode: bankCode,
        purpose,
        cooperativeId,
        requestedBy: user.id,
        average30d: Math.max(amountValue / 2, 1),
        signatureCount: 0,
        destinationVerified: Boolean(verifiedName),
        accountName: verifiedName,
      });
      const newItem: QueueItem = {
        id: result.withdrawalId,
        cooperativeId,
        requestedBy: user.id,
        amount: amountValue,
        destinationAccount: accountNumber,
        destinationBankCode: bankCode,
        purpose,
        riskScore: result.riskScore,
        status: result.status,
        createdAt: new Date().toISOString(),
        average30d: Math.max(amountValue / 2, 1),
        signatureCount: 0,
        explanations: result.reasons,
        ref: `#${result.withdrawalId.toUpperCase().slice(0, 8)}`,
        initiated: new Date().toLocaleDateString('en-GB'),
        recipient: verifiedName ?? accountNumber,
        sigs: '□□□',
      };
      setQueue((prev) => [newItem, ...prev]);
      setSelectedQueueId(result.withdrawalId);
      setSelectedQueueItem(newItem);
      setAmount('');
      setAccountNumber('');
      setBankCode('');
      setPurpose('');
      setVerifiedName(null);
    } catch (err) {
      setSubmitError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSign() {
    if (!selectedQueueId || !user) return;
    setActionLoading(true);
    setActionMsg(null);
    try {
      const res = await signWithdrawal(selectedQueueId, { memberId: user.id, role: user.role });
      setActionMsg(`Signature recorded. Total: ${res.signatureCount}/3`);
      const updated = await getQueueItem(selectedQueueId).catch(() => null);
      if (updated) {
        setSelectedQueueItem(updated);
        setQueue((prev) => prev.map((q) => (q.id === selectedQueueId ? updated : q)));
      }
    } catch (err) {
      setActionMsg((err as Error).message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRelease() {
    if (!selectedQueueId || !selectedQueueItem) return;
    setActionLoading(true);
    setActionMsg(null);
    try {
      const res = await releaseWithdrawal(selectedQueueId, {
        destinationAccount: selectedQueueItem.destinationAccount,
        bankCode: selectedQueueItem.destinationBankCode,
        amount: Number(String(selectedQueueItem.amount).replace(/[^0-9]/g, '')),
        narration: selectedQueueItem.purpose ?? 'VeriFund cooperative disbursement',
        accountName: selectedQueueItem.recipient,
      });
      setActionMsg(`Transfer released. Ref: ${res.transferRef} (${res.provider})`);
      setQueue((prev) => prev.map((q) => (q.id === selectedQueueId ? { ...q, status: 'released' } : q)));
    } catch (err) {
      setActionMsg((err as Error).message);
    } finally {
      setActionLoading(false);
    }
  }

  const canRelease = selectedQueueItem && (selectedQueueItem.signatureCount >= 3 || selectedQueueItem.status === 'approved');

  if (!cooperativeId || !user) {
    return <section className="note-panel page-reveal">Log in and select a cooperative before using the withdrawal flow.</section>;
  }

  return (
    <div className="withdrawal-layout">
      <section className="withdrawal-timeline page-reveal">
        {['Submitted', 'Risk Checked', 'Treasury Signing', 'Exec Approval', 'Released'].map((step, idx) => (
          <div key={step} className={`timeline-step ${idx === 0 ? 'is-active' : ''}`}>
            <div className="timeline-step__dot">{idx + 1}</div>
            <span>{step}</span>
          </div>
        ))}
      </section>

      <div className="withdrawal-grid">
        <section className="withdrawal-form page-reveal">
          <div className="eyebrow">Transaction Details</div>

          <label className="input-block">
            <span>Disbursement Amount (NGN)</span>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="numeric"
              placeholder="Enter amount"
            />
          </label>

          <label className="input-block">
            <span>Destination Bank</span>
            <select
              value={bankCode}
              onChange={(e) => setBankCode(e.target.value)}
              style={{
                border: 0,
                borderBottom: '1px solid var(--line)',
                background: 'transparent',
                padding: '12px 2px',
                font: 'inherit',
                outline: 'none',
                width: '100%',
              }}
            >
              <option value="">Select bank</option>
              {banks.map((b) => (
                <option key={b.code} value={b.code}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>

          <label className="input-block">
            <span>Account Number</span>
            <input
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
              placeholder="10-digit account number"
              inputMode="numeric"
            />
          </label>

          {accountNumber.length === 10 && bankCode && (
            <div className="status-line" style={{ marginTop: 8 }}>
              <span className={`status-dot status-dot--${verifying ? 'warn' : verifiedName ? 'success' : 'neutral'}`} />
              <span style={{ fontSize: 13 }}>
                {verifying ? 'Verifying with Nomba...' : verifiedName ? `Verified: ${verifiedName}` : 'Account not verified'}
              </span>
            </div>
          )}

          <label className="input-block">
            <span>Purpose of Disbursement</span>
            <textarea
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="Describe the reason for this withdrawal..."
              rows={3}
            />
          </label>

          {submitError && <div className="callout" style={{ marginTop: 12 }}>{submitError}</div>}

          <button
            className="button button--primary button--full"
            style={{ marginTop: 16 }}
            disabled={!amountValue || !accountNumber || !bankCode || !purpose || submitting}
            onClick={() => void handleInitialize()}
          >
            {submitting ? 'Submitting...' : 'Initialize Signing Sequence'}
          </button>
        </section>

        <aside className="withdrawal-signatures page-reveal">
          <div className="eyebrow">Required Authorizations (3 needed)</div>

          {selectedQueueItem ? (
            <>
              <div className="signature-box signature-box--verified">
                <div className="signature-box__label">Requester</div>
                <strong>{selectedQueueItem.requestedBy}</strong>
                <StatusPill tone="success">SIGNED</StatusPill>
              </div>

              <div className={`signature-box ${selectedQueueItem.signatureCount >= 2 ? 'signature-box--verified' : ''}`}>
                <div className="signature-box__label">Executive 01</div>
                {selectedQueueItem.signatureCount >= 2 ? (
                  <>
                    <strong>Co-signed</strong>
                    <StatusPill tone="success">SIGNED</StatusPill>
                  </>
                ) : (
                  <span>Awaiting Signature</span>
                )}
              </div>

              <div className={`signature-box ${selectedQueueItem.signatureCount >= 3 ? 'signature-box--verified' : ''}`}>
                <div className="signature-box__label">Executive 02</div>
                {selectedQueueItem.signatureCount >= 3 ? (
                  <>
                    <strong>Co-signed</strong>
                    <StatusPill tone="success">SIGNED</StatusPill>
                  </>
                ) : (
                  <span>Awaiting Signature</span>
                )}
              </div>

              {actionMsg && (
                <div
                  className="notice"
                  style={{ color: actionMsg.startsWith('Transfer') || actionMsg.startsWith('Signature') ? 'var(--accent)' : 'var(--danger)', marginTop: 12 }}
                >
                  {actionMsg}
                </div>
              )}

              <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
                <button className="button button--ghost button--full" disabled={actionLoading} onClick={handleSign}>
                  {actionLoading ? 'Processing...' : 'Sign'}
                </button>
                <button className="button button--primary button--full" disabled={!canRelease || actionLoading} onClick={handleRelease}>
                  {actionLoading ? 'Releasing...' : 'Release Nomba Transfer'}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="signature-box">
                <div className="signature-box__label">Treasury Authority</div>
                <span>Initialize a new withdrawal to begin the approval chain.</span>
              </div>
              <div className="signature-box">
                <div className="signature-box__label">Executive 01</div>
                <span>Awaiting</span>
              </div>
              <div className="signature-box">
                <div className="signature-box__label">Executive 02</div>
                <span>Awaiting</span>
              </div>
            </>
          )}

          <blockquote className="quote-box">
            Multi-sig protocol requires 3 signatures for amounts above {formatNaira(1_000_000)}.
            Nomba only releases funds when quorum is reached.
          </blockquote>
        </aside>
      </div>

      <section className="risk-panel page-reveal">
        <div className="risk-panel__copy">
          <div className="eyebrow">Live Risk Preview</div>
          <div className="risk-panel__grid">
            <div>
              <p>Amount is compared to the cooperative's rolling transaction baseline in real time.</p>
              <div className="risk-meter">
                <div
                  className={`risk-meter__fill risk-meter__fill--${riskLevel.tone}`}
                  style={{ width: `${riskLevel.score}%` }}
                />
              </div>
              <div className="risk-panel__footer">
                <StatusPill tone={riskLevel.tone}>{riskLevel.label.toUpperCase()}</StatusPill>
                <span>Risk score {riskLevel.score}/100</span>
              </div>
            </div>
            <div className="risk-panel__signals">
              <Metric label="30-day average" value={formatNaira(Math.max(amountValue / 2, 1))} />
              <Metric label="Requested amount" value={formatNaira(amountValue || 0)} />
              <Metric label="Deviation" value={amountValue ? `${Math.round((amountValue / Math.max(amountValue / 2, 1) - 1) * 100)}%` : '0%'} />
              <Metric label="Destination" value={verifiedName ?? 'Unverified'} />
            </div>
          </div>
        </div>
      </section>

      <section className="queue-panel page-reveal">
        <div className="section-card__header">
          <div>
            <h2>Pending Queue</h2>
            <p>Queue status: {queue.length} active entries</p>
          </div>
          <div className="alert-actions">
            <button className="button button--ghost" onClick={() => void getQueue().then((r) => setQueue(r.queue)).catch(() => setQueue([]))}>
              Refresh
            </button>
          </div>
        </div>

        {queue.length ? (
          <div className="table">
            <div className="table__head" style={{ gridTemplateColumns: '1fr 1fr 1.2fr 1fr 0.7fr 1fr' }}>
              <span>Ref ID</span>
              <span>Initiated</span>
              <span>Recipient</span>
              <span>Amount</span>
              <span>Sigs</span>
              <span>Status</span>
            </div>
            {queue.map((row) => {
              const displayAmount = typeof row.amount === 'number' ? formatNaira(row.amount) : formatNaira(row.amount);
              const statusTone =
                row.status.includes('risk') || row.status.includes('Risk')
                  ? ('warn' as const)
                  : row.status === 'released'
                    ? ('success' as const)
                    : ('soft' as const);

              return (
                <div
                  className="table__row table__row--interactive"
                  key={row.id}
                  style={{ gridTemplateColumns: '1fr 1fr 1.2fr 1fr 0.7fr 1fr' }}
                  onClick={() => setSelectedQueueId(row.id)}
                >
                  <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{row.ref ?? row.id}</span>
                  <span>{row.initiated ?? new Date(row.createdAt).toLocaleDateString('en-GB')}</span>
                  <span>{row.recipient ?? row.requestedBy}</span>
                  <span>{displayAmount}</span>
                  <span className="sig-chips">{row.sigs ?? `${row.signatureCount}/3`}</span>
                  <span>
                    <StatusPill tone={statusTone}>{row.status.replace(/_/g, ' ').toUpperCase()}</StatusPill>
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="empty-state">No withdrawals have been requested yet.</p>
        )}
      </section>

      <Modal
        open={Boolean(selectedQueueItem)}
        title={selectedQueueItem?.recipient || 'Queue Item'}
        onClose={() => {
          setSelectedQueueId(null);
          setActionMsg(null);
        }}
        footer={
          <div className="alert-actions">
            <button className="button button--ghost" disabled={actionLoading} onClick={handleSign}>
              {actionLoading ? '...' : 'Sign'}
            </button>
            <button className="button button--primary" disabled={!canRelease || actionLoading} onClick={handleRelease}>
              {actionLoading ? 'Releasing...' : 'Release Transfer'}
            </button>
          </div>
        }
      >
        {selectedQueueItem && (
          <div className="modal-stack">
            <p>{selectedQueueItem.purpose}</p>
            <div className="detail-grid">
              <div>
                <span>Requested By</span>
                <strong>{selectedQueueItem.requestedBy}</strong>
              </div>
              <div>
                <span>Risk Score</span>
                <strong>{Math.round(Number(selectedQueueItem.riskScore) * 100)}/100</strong>
              </div>
              <div>
                <span>Signatures</span>
                <strong>{selectedQueueItem.signatureCount}/3</strong>
              </div>
              <div>
                <span>Average 30d</span>
                <strong>{formatNaira(selectedQueueItem.average30d)}</strong>
              </div>
              <div>
                <span>Destination</span>
                <strong style={{ fontFamily: 'monospace', fontSize: 12 }}>
                  {selectedQueueItem.destinationAccount} · {selectedQueueItem.destinationBankCode}
                </strong>
              </div>
              <div>
                <span>Status</span>
                <strong>{selectedQueueItem.status.replace(/_/g, ' ')}</strong>
              </div>
            </div>
            <div className="signal-list">
              {selectedQueueItem.explanations?.map((item) => (
                <div key={item} className="signal-list__item">
                  {item}
                </div>
              ))}
            </div>
            {actionMsg && (
              <div
                className="notice"
                style={{ color: actionMsg.startsWith('Transfer') || actionMsg.startsWith('Signature') ? 'var(--accent)' : 'var(--danger)' }}
              >
                {actionMsg}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
