import { useEffect, useMemo, useState } from 'react';
import { Metric } from '../components/Metric';
import { Modal } from '../components/Modal';
import { StatusPill } from '../components/StatusPill';
import { useAuth } from '../auth/AuthContext';
import { ACTIVE_COOPERATIVE_EVENT } from '../components/Shell';
import {
  getBanks,
  getQueue,
  getQueueItem,
  previewWithdrawalRisk,
  releaseWithdrawal,
  requestWithdrawal,
  signWithdrawal,
  verifyAccount,
  type QueueItem,
  type WithdrawalRiskPreviewResponse,
} from '../services/api';

type Bank = { code: string; name: string };

const fallbackBanks: Bank[] = [
  { code: '058', name: 'Guaranty Trust Bank' },
  { code: '011', name: 'First Bank of Nigeria' },
  { code: '057', name: 'Zenith Bank' },
  { code: '033', name: 'United Bank for Africa' },
  { code: '044', name: 'Access Bank' },
];

function loadCooperativeId() {
  return localStorage.getItem('verifund_cooperative_id') || '';
}

function formatNaira(value: number | string) {
  const n = typeof value === 'string' ? Number(value.replace(/[^0-9.]/g, '')) : value;
  if (Number.isNaN(n)) return '₦0.00';
  return `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
}

const requestWithdrawalRoles = ['admin', 'treasurer'];
const signWithdrawalRoles = ['admin', 'treasurer', 'executive1', 'executive2'];
const releaseWithdrawalRoles = ['admin', 'treasurer'];

export function WithdrawalPage() {
  const { user } = useAuth();
  const [cooperativeId, setCooperativeId] = useState(loadCooperativeId);
  const [amount, setAmount] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [bankCode, setBankCode] = useState('');
  const [purpose, setPurpose] = useState('');
  const [banks, setBanks] = useState<Bank[]>([]);
  const [bankNotice, setBankNotice] = useState<string | null>(null);
  const [verifiedName, setVerifiedName] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [selectedQueueId, setSelectedQueueId] = useState<string | null>(null);
  const [selectedQueueItem, setSelectedQueueItem] = useState<QueueItem | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [riskPreview, setRiskPreview] = useState<WithdrawalRiskPreviewResponse | null>(null);
  const [riskLoading, setRiskLoading] = useState(false);
  const [riskError, setRiskError] = useState<string | null>(null);

  async function refreshQueue() {
    setQueueLoading(true);
    setQueueError(null);
    try {
      const res = await getQueue();
      setQueue(res.queue);
    } catch (err) {
      setQueue([]);
      setQueueError(err instanceof Error ? err.message : 'Withdrawal queue could not be loaded.');
    } finally {
      setQueueLoading(false);
    }
  }

  useEffect(() => {
    void getBanks()
      .then((res) => {
        setBanks(res.banks.length ? res.banks : fallbackBanks);
        setBankNotice(res.mode === 'live' ? null : `Bank list is using ${res.mode} mode.`);
      })
      .catch((err) => {
        setBanks(fallbackBanks);
        setBankNotice(err instanceof Error ? err.message : 'Using fallback bank list.');
      });
  }, []);

  useEffect(() => {
    void refreshQueue();
  }, []);

  useEffect(() => {
    function syncActiveCooperative() {
      setCooperativeId(loadCooperativeId());
    }

    window.addEventListener(ACTIVE_COOPERATIVE_EVENT, syncActiveCooperative);
    window.addEventListener('storage', syncActiveCooperative);

    return () => {
      window.removeEventListener(ACTIVE_COOPERATIVE_EVENT, syncActiveCooperative);
      window.removeEventListener('storage', syncActiveCooperative);
    };
  }, []);

  useEffect(() => {
    if (!selectedQueueId) {
      setSelectedQueueItem(null);
      return;
    }
    const cached = queue.find((item) => item.id === selectedQueueId);
    if (cached) {
      setSelectedQueueItem(cached);
      return;
    }
    void getQueueItem(selectedQueueId).then(setSelectedQueueItem).catch(() => setSelectedQueueItem(null));
  }, [queue, selectedQueueId]);

  useEffect(() => {
    setVerifiedName(null);
    setVerifyError(null);
    if (accountNumber.length === 10 && bankCode) {
      setVerifying(true);
      verifyAccount(accountNumber, bankCode)
        .then((res) => {
          setVerifiedName(res.verified ? (res.accountName ?? 'Verified') : null);
          setVerifyError(res.verified ? null : res.error ?? 'Account could not be verified.');
        })
        .catch((err) => {
          setVerifiedName(null);
          setVerifyError(err instanceof Error ? err.message : 'Account verification failed.');
        })
        .finally(() => setVerifying(false));
    }
  }, [accountNumber, bankCode]);

  const amountValue = Number(amount.replace(/[^0-9]/g, '') || 0);
  const trimmedPurpose = purpose.trim();
  const userRole = user?.role ?? '';
  const canRequestWithdrawal = requestWithdrawalRoles.includes(userRole);
  const canSignWithdrawal = signWithdrawalRoles.includes(userRole);
  const canReleaseWithdrawal = releaseWithdrawalRoles.includes(userRole);
  const canSubmitWithdrawal = Boolean(
    amountValue &&
      accountNumber.length === 10 &&
      bankCode &&
      trimmedPurpose &&
      cooperativeId &&
      user &&
      canRequestWithdrawal &&
      verifiedName &&
      !verifying,
  );
  const average30d = Math.max(amountValue / 2, 1);

  useEffect(() => {
    if (!amountValue) {
      setRiskPreview(null);
      setRiskError(null);
      setRiskLoading(false);
      return;
    }

    let cancelled = false;
    setRiskLoading(true);
    setRiskError(null);

    const timeout = window.setTimeout(() => {
      void previewWithdrawalRisk({
        amount: amountValue,
        average30d,
        signatureCount: selectedQueueItem?.signatureCount ?? 0,
        destinationVerified: Boolean(verifiedName),
        bvnDuplicate: false,
        purpose: trimmedPurpose,
      })
        .then((preview) => {
          if (!cancelled) setRiskPreview(preview);
        })
        .catch((err) => {
          if (!cancelled) {
            setRiskPreview(null);
            setRiskError(err instanceof Error ? err.message : 'Risk preview could not be calculated.');
          }
        })
        .finally(() => {
          if (!cancelled) setRiskLoading(false);
        });
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [amountValue, average30d, trimmedPurpose, verifiedName, selectedQueueItem?.signatureCount]);

  const riskLevel = useMemo(() => {
    if (!amountValue) return { label: 'Idle', tone: 'neutral' as const, score: 0 };
    if (!riskPreview) return { label: riskLoading ? 'Loading' : 'Unknown', tone: 'neutral' as const, score: 0 };

    const score = Math.round(riskPreview.riskScore * 100);
    const tone =
      riskPreview.riskCategory === 'high'
        ? ('danger' as const)
        : riskPreview.riskCategory === 'medium'
          ? ('warn' as const)
          : ('success' as const);

    return {
      label: riskPreview.riskCategory,
      tone,
      score,
    };
  }, [amountValue, riskLoading, riskPreview]);

  async function handleInitialize() {
    if (!canSubmitWithdrawal || !user) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await requestWithdrawal({
        amount: amountValue,
        destinationAccount: accountNumber,
        destinationBankCode: bankCode,
        purpose: trimmedPurpose,
        cooperativeId,
        requestedBy: user.id,
      });

      const newItem: QueueItem = {
        id: result.withdrawalId,
        cooperativeId,
        requestedBy: user.id,
        amount: amountValue,
        destinationAccount: accountNumber,
        destinationBankCode: bankCode,
        purpose: trimmedPurpose,
        riskScore: result.riskScore,
        status: result.status,
        createdAt: new Date().toISOString(),
        average30d,
        signatureCount: 0,
        explanations: result.reasons,
        ref: `#${result.withdrawalId.toUpperCase().slice(0, 8)}`,
        initiated: new Date().toLocaleDateString('en-GB'),
        recipient: verifiedName ?? accountNumber,
        sigs: '□ □ □',
      };

      setQueue((prev) => [newItem, ...prev.filter((item) => item.id !== newItem.id)]);
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
    if (!selectedQueueId || !user || !canSignWithdrawal) return;
    setActionLoading(true);
    setActionMsg(null);
    try {
      const res = await signWithdrawal(selectedQueueId, {});
      setActionMsg(`Signature recorded. Total: ${res.signatureCount}/3`);
      const updated = await getQueueItem(selectedQueueId).catch(() => null);
      if (updated) {
        setSelectedQueueItem(updated);
        setQueue((prev) => prev.map((item) => (item.id === selectedQueueId ? updated : item)));
      }
      await refreshQueue();
    } catch (err) {
      setActionMsg((err as Error).message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRelease() {
    if (!selectedQueueId || !selectedQueueItem || !canReleaseWithdrawal) return;
    setActionLoading(true);
    setActionMsg(null);
    try {
      const res = await releaseWithdrawal(selectedQueueId);
      setActionMsg(`Transfer released. Ref: ${res.transferRef} (${res.provider})`);
      const releasedItem = { ...selectedQueueItem, status: res.status };
      setSelectedQueueItem(releasedItem);
      setQueue((prev) => prev.map((item) => (item.id === selectedQueueId ? releasedItem : item)));
      await refreshQueue();
    } catch (err) {
      setActionMsg((err as Error).message);
    } finally {
      setActionLoading(false);
    }
  }

  const canRelease = Boolean(
    canReleaseWithdrawal &&
      selectedQueueItem &&
      (selectedQueueItem.signatureCount >= 3 || selectedQueueItem.status === 'approved'),
  );

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

          {!canRequestWithdrawal && (
            <div className="callout" style={{ marginBottom: 12 }}>
              Your role can review and sign withdrawal requests, but only admins and treasurers can create them.
            </div>
          )}

          {bankNotice && <div className="notice" style={{ marginBottom: 12 }}>{bankNotice}</div>}

          <label className="input-block">
            <span>Disbursement Amount (NGN)</span>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" placeholder="Enter amount" />
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
              {banks.map((bank) => (
                <option key={bank.code} value={bank.code}>
                  {bank.name}
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
          {verifyError && <div className="callout" style={{ marginTop: 8 }}>{verifyError}</div>}

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
            disabled={!canSubmitWithdrawal || submitting}
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
                  style={{
                    color:
                      actionMsg.startsWith('Transfer') || actionMsg.startsWith('Signature')
                        ? 'var(--accent)'
                        : 'var(--danger)',
                    marginTop: 12,
                  }}
                >
                  {actionMsg}
                </div>
              )}

              <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
                <button
                  className="button button--ghost button--full"
                  disabled={!canSignWithdrawal || actionLoading}
                  onClick={handleSign}
                >
                  {actionLoading ? 'Processing...' : 'Sign'}
                </button>
                <button className="button button--primary button--full" disabled={!canRelease || actionLoading} onClick={handleRelease}>
                  {actionLoading ? 'Releasing...' : 'Release Nomba Transfer'}
                </button>
              </div>

              {!canReleaseWithdrawal && (
                <div className="callout" style={{ marginTop: 12 }}>
                  Release is restricted to admins and treasurers after quorum is reached.
                </div>
              )}
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
                <span>{riskLoading ? 'Calculating backend risk...' : `Risk score ${riskLevel.score}/100`}</span>
              </div>
              {riskError && <div className="callout" style={{ marginTop: 12 }}>{riskError}</div>}
              {riskPreview && (
                <div className="signal-list" style={{ marginTop: 12 }}>
                  {(riskPreview.reasons.length ? riskPreview.reasons : riskPreview.explanation).map((item) => (
                    <div key={item} className="signal-list__item">
                      {item}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="risk-panel__signals">
              <Metric label="30-day average" value={formatNaira(average30d)} />
              <Metric label="Requested amount" value={formatNaira(amountValue || 0)} />
              <Metric
                label="Deviation"
                value={riskPreview ? `${Math.round((riskPreview.signals.ratio - 1) * 100)}%` : '0%'}
              />
              <Metric label="Destination" value={verifiedName ?? 'Unverified'} />
              <Metric
                label="Approval Count"
                value={`${riskPreview?.signals.signatureCount ?? selectedQueueItem?.signatureCount ?? 0}/3`}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="queue-panel page-reveal">
        <div className="section-card__header">
          <div>
            <h2>Pending Queue</h2>
            <p>
              {queueLoading
                ? 'Loading withdrawal queue...'
                : queueError
                  ? 'Queue could not be loaded'
                  : `Queue status: ${queue.length} active entries`}
            </p>
          </div>
          <div className="alert-actions">
            <button className="button button--ghost" disabled={queueLoading} onClick={() => void refreshQueue()}>
              {queueLoading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        {queueError ? (
          <div className="callout">
            {queueError}
            <button className="button button--ghost" style={{ marginTop: 12 }} onClick={() => void refreshQueue()}>
              Retry Queue
            </button>
          </div>
        ) : queue.length ? (
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
                  <span>{formatNaira(row.amount)}</span>
                  <span className="sig-chips">{row.sigs ?? `${row.signatureCount}/3`}</span>
                  <span>
                    <StatusPill tone={statusTone}>{row.status.replace(/_/g, ' ').toUpperCase()}</StatusPill>
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="empty-state">
            {queueLoading ? 'Loading withdrawal requests...' : 'No withdrawals have been requested yet.'}
          </p>
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
            <button className="button button--ghost" disabled={!canSignWithdrawal || actionLoading} onClick={handleSign}>
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
