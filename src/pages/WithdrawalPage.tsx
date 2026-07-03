import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../components/Modal';
import { pendingQueue, withdrawalRiskSignals } from '../data';
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

function formatNaira(value: number | string) {
  const n = typeof value === 'string' ? Number(value.replace(/[^0-9.]/g, '')) : value;
  if (isNaN(n)) return '₦0.00';
  return `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
}

export function WithdrawalPage() {
  const [amount, setAmount] = useState('850000');
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

  // Load bank list
  useEffect(() => {
    getBanks()
      .then((res) => setBanks(res.banks))
      .catch(() => {});
  }, []);

  // Load queue
  useEffect(() => {
    getQueue().then((res) => setQueue(res.queue));
  }, []);

  // Load selected item
  useEffect(() => {
    if (!selectedQueueId) { setSelectedQueueItem(null); return; }
    const cached = queue.find((i) => i.id === selectedQueueId);
    if (cached) { setSelectedQueueItem(cached); return; }
    void getQueueItem(selectedQueueId).then(setSelectedQueueItem);
  }, [queue, selectedQueueId]);

  // Auto-verify account when 10 digits entered and bank selected
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
    if (!amountValue || !accountNumber || !bankCode || !purpose) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await requestWithdrawal({
        amount: amountValue,
        destinationAccount: accountNumber,
        destinationBankCode: bankCode,
        purpose,
        average30d: 510_000,
        signatureCount: 0,
        destinationVerified: Boolean(verifiedName),
        accountName: verifiedName,
      });
      const newItem: QueueItem = {
        id: result.withdrawalId,
        ref: `#${result.withdrawalId.toUpperCase().slice(0, 8)}`,
        initiated: new Date().toLocaleDateString('en-GB'),
        recipient: verifiedName ?? accountNumber,
        amount: amountValue.toString(),
        sigs: '□□□',
        status: result.status.replace(/_/g, ' '),
        destinationAccount: accountNumber,
        destinationBankCode: bankCode,
        purpose,
        requestedBy: 'Current User',
        signatureCount: 0,
        average30d: 510_000,
        riskScore: result.riskScore,
        explanations: result.reasons,
      };
      setQueue((prev) => [newItem, ...prev]);
      setSelectedQueueId(result.withdrawalId);
      setSelectedQueueItem(newItem);
      // Reset form
      setAmount('850000');
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
    if (!selectedQueueId) return;
    setActionLoading(true);
    setActionMsg(null);
    try {
      const res = await signWithdrawal(selectedQueueId, {});
      setActionMsg(`✓ Signature recorded. Total: ${res.signatureCount}/3`);
      // Refresh the item
      const updated = await getQueueItem(selectedQueueId).catch(() => null);
      if (updated) {
        setSelectedQueueItem(updated);
        setQueue((prev) => prev.map((q) => (q.id === selectedQueueId ? updated : q)));
      }
    } catch (err) {
      setActionMsg(`✗ ${(err as Error).message}`);
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
      setActionMsg(`✓ Transfer released! Ref: ${res.transferRef} (${res.provider})`);
      setQueue((prev) =>
        prev.map((q) =>
          q.id === selectedQueueId ? { ...q, status: 'released' } : q
        )
      );
    } catch (err) {
      setActionMsg(`✗ ${(err as Error).message}`);
    } finally {
      setActionLoading(false);
    }
  }

  const canRelease =
    selectedQueueItem &&
    (selectedQueueItem.signatureCount >= 3 || selectedQueueItem.status === 'approved');

  return (
    <div className="withdrawal-layout">
      {/* Timeline */}
      <section className="withdrawal-timeline page-reveal">
        {['Submitted', 'Risk Checked', 'Treasury Signing', 'Exec Approval', 'Released'].map((step, idx) => (
          <div key={step} className={`timeline-step ${idx === 0 ? 'is-active' : ''}`}>
            <div className="timeline-step__dot">{idx + 1}</div>
            <span>{step}</span>
          </div>
        ))}
      </section>

      <div className="withdrawal-grid">
        {/* Form */}
        <section className="withdrawal-form page-reveal">
          <div className="eyebrow">Transaction Details</div>

          <label className="input-block">
            <span>Disbursement Amount (NGN)</span>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="numeric"
              placeholder="0"
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
              <option value="">Select bank…</option>
              {banks.map((b) => (
                <option key={b.code} value={b.code}>{b.name}</option>
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

          {/* Account verification feedback */}
          {accountNumber.length === 10 && bankCode && (
            <div className="status-line" style={{ marginTop: 8 }}>
              <span className={`status-dot status-dot--${verifying ? 'warn' : verifiedName ? 'success' : 'neutral'}`} />
              <span style={{ fontSize: 13 }}>
                {verifying
                  ? 'Verifying with Nomba…'
                  : verifiedName
                  ? `Verified: ${verifiedName}`
                  : 'Account not verified'}
              </span>
            </div>
          )}

          <label className="input-block">
            <span>Purpose of Disbursement</span>
            <textarea
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="Describe the reason for this withdrawal…"
              rows={3}
            />
          </label>

          {submitError && (
            <div className="callout" style={{ marginTop: 12 }}>{submitError}</div>
          )}

          <button
            className="button button--primary button--full"
            style={{ marginTop: 16 }}
            disabled={!amountValue || !accountNumber || !bankCode || !purpose || submitting}
            onClick={() => void handleInitialize()}
          >
            {submitting ? 'Submitting…' : 'Initialize Signing Sequence'}
          </button>
        </section>

        {/* Signatures panel */}
        <aside className="withdrawal-signatures page-reveal">
          <div className="eyebrow">Required Authorizations (3 needed)</div>

          {selectedQueueItem ? (
            <>
              <div className="signature-box signature-box--verified">
                <div className="signature-box__label">Treasurer (1st sig)</div>
                <strong>{selectedQueueItem.requestedBy}</strong>
                <StatusPill tone="success">SIGNED</StatusPill>
              </div>

              <div className={`signature-box ${selectedQueueItem.signatureCount >= 2 ? 'signature-box--verified' : ''}`}>
                <div className="signature-box__label">Executive 01 (2nd sig)</div>
                {selectedQueueItem.signatureCount >= 2
                  ? <><strong>Co-signed</strong><StatusPill tone="success">SIGNED</StatusPill></>
                  : <span>Awaiting Signature</span>}
              </div>

              <div className={`signature-box ${selectedQueueItem.signatureCount >= 3 ? 'signature-box--verified' : ''}`}>
                <div className="signature-box__label">Executive 02 (3rd sig)</div>
                {selectedQueueItem.signatureCount >= 3
                  ? <><strong>Co-signed</strong><StatusPill tone="success">SIGNED</StatusPill></>
                  : <span>Awaiting Signature</span>}
              </div>

              {actionMsg && (
                <div
                  className="notice"
                  style={{ color: actionMsg.startsWith('✓') ? 'var(--accent)' : 'var(--danger)', marginTop: 12 }}
                >
                  {actionMsg}
                </div>
              )}

              <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
                <button
                  className="button button--ghost button--full"
                  disabled={actionLoading}
                  onClick={handleSign}
                >
                  {actionLoading ? 'Processing…' : '✍ Sign as Current User'}
                </button>
                <button
                  className="button button--primary button--full"
                  disabled={!canRelease || actionLoading}
                  onClick={handleRelease}
                >
                  {actionLoading ? 'Releasing…' : '⚡ Release Nomba Transfer'}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="signature-box">
                <div className="signature-box__label">Treasury Authority</div>
                <span>Select a queue item or initialize a new one</span>
              </div>
              <div className="signature-box"><div className="signature-box__label">Executive 01</div><span>Awaiting</span></div>
              <div className="signature-box"><div className="signature-box__label">Executive 02</div><span>Awaiting</span></div>
            </>
          )}

          <blockquote className="quote-box">
            Multi-sig protocol requires 3 signatures for amounts &gt; ₦1,000,000.
            The treasurer <em>structurally cannot touch the money</em> — Nomba only releases
            on quorum.
          </blockquote>
        </aside>
      </div>

      {/* Risk panel */}
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
              {withdrawalRiskSignals.map((signal) => (
                <Metric key={signal.label} label={signal.label} value={signal.value} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Queue */}
      <section className="queue-panel page-reveal">
        <div className="section-card__header">
          <div>
            <h2>Pending Queue</h2>
            <p>Queue status: {queue.length || pendingQueue.length} active entries</p>
          </div>
          <div className="alert-actions">
            <button className="button button--ghost" onClick={() => getQueue().then((r) => setQueue(r.queue))}>
              Refresh
            </button>
          </div>
        </div>

        <div className="table">
          <div className="table__head" style={{ gridTemplateColumns: '1fr 1fr 1.2fr 1fr 0.7fr 1fr' }}>
            <span>Ref ID</span>
            <span>Initiated</span>
            <span>Recipient</span>
            <span>Amount</span>
            <span>Sigs</span>
            <span>Status</span>
          </div>
          {(queue.length ? queue : pendingQueue).map((row) => {
            const displayAmount = typeof row.amount === 'number'
              ? formatNaira(row.amount)
              : row.amount.startsWith('₦')
              ? row.amount
              : formatNaira(row.amount);

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
                <span>{row.initiated}</span>
                <span>{row.recipient}</span>
                <span>{displayAmount}</span>
                <span className="sig-chips">{row.sigs}</span>
                <span>
                  <StatusPill tone={statusTone}>
                    {row.status.replace(/_/g, ' ').toUpperCase()}
                  </StatusPill>
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Detail modal */}
      <Modal
        open={Boolean(selectedQueueItem)}
        title={selectedQueueItem?.recipient || 'Queue Item'}
        onClose={() => { setSelectedQueueId(null); setActionMsg(null); }}
        footer={
          <div className="alert-actions">
            <button className="button button--ghost" disabled={actionLoading} onClick={handleSign}>
              {actionLoading ? '…' : '✍ Sign'}
            </button>
            <button
              className="button button--primary"
              disabled={!canRelease || actionLoading}
              onClick={handleRelease}
            >
              {actionLoading ? 'Releasing…' : '⚡ Release Transfer'}
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
                <div key={item} className="signal-list__item">{item}</div>
              ))}
            </div>
            {actionMsg && (
              <div
                className="notice"
                style={{ color: actionMsg.startsWith('✓') ? 'var(--accent)' : 'var(--danger)' }}
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
