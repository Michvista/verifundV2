import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Metric } from '../components/Metric';
import { SectionCard } from '../components/SectionCard';
import { StatusPill } from '../components/StatusPill';
import { BarChart } from '../components/BarChart';
import { AuditLogPanel } from '../components/AuditLogPanel';
import { getCooperative, type CooperativeResponse } from '../services/api';
import { ACTIVE_COOPERATIVE_EVENT } from '../components/Shell';

function loadCooperativeId() {
  return localStorage.getItem('verifund_cooperative_id') || '';
}

function loadVirtualAccount() {
  try {
    const raw = localStorage.getItem('verifund_virtual_account');
    return raw ? JSON.parse(raw) as { accountNumber: string; bankName: string } : null;
  } catch {
    return null;
  }
}

export function CooperativePage() {
  const navigate = useNavigate();
  const [cooperativeId, setCooperativeId] = useState(loadCooperativeId);
  const [cooperative, setCooperative] = useState<CooperativeResponse | null>(null);
  const [virtualAccount, setVirtualAccount] = useState(loadVirtualAccount);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadCooperative() {
    if (!cooperativeId) return;

    setLoading(true);
    setError(null);
    try {
      setCooperative(await getCooperative(cooperativeId));
    } catch (err) {
      setCooperative(null);
      setError(err instanceof Error ? err.message : 'Cooperative could not be loaded.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCooperative();
  }, [cooperativeId]);

  useEffect(() => {
    function syncActiveCooperative() {
      setCooperativeId(loadCooperativeId());
      setVirtualAccount(loadVirtualAccount());
    }

    window.addEventListener(ACTIVE_COOPERATIVE_EVENT, syncActiveCooperative);
    window.addEventListener('storage', syncActiveCooperative);

    return () => {
      window.removeEventListener(ACTIVE_COOPERATIVE_EVENT, syncActiveCooperative);
      window.removeEventListener('storage', syncActiveCooperative);
    };
  }, []);

  if (!cooperativeId) {
    return (
      <SectionCard
        title="No cooperative selected"
        subtitle="Create a cooperative first to inspect its live record."
        className="page-reveal"
      >
        <p className="empty-state">Use the setup page to create the treasury and load this view.</p>
      </SectionCard>
    );
  }

  const trustValues = cooperative?.scoreBreakdown?.map((item) => item.value) ?? [];
  const scoreLabel = cooperative ? 'Live' : loading ? 'Loading' : 'Idle';

  return (
    <div className="cooperative-layout">
      <aside className="identity-panel page-reveal">
        <div className="eyebrow">Entity Identity</div>
        <h2>{cooperative?.name ?? (loading ? 'Loading cooperative...' : cooperativeId)}</h2>
        <p>{cooperative?.state ?? (loading ? 'Fetching live record' : 'Live cooperative record')}</p>
        <div className="identity-panel__meta">
          <Metric label="Registration" value={cooperative?.registrationNumber ?? (loading ? 'Loading...' : cooperativeId)} />
          <Metric
            label="Member Count"
            value={cooperative ? `${cooperative.memberCount.toLocaleString()} Active` : loading ? 'Loading...' : 'Unavailable'}
          />
        </div>
        <div className="seal">VERIFUND CERTIFIED</div>
        <div className="stacked-actions">
          <button className="button button--primary button--full" disabled>
            Export Full Report
          </button>
          <button className="button button--ghost button--full" onClick={() => navigate('/dashboard')}>
            View Treasury
          </button>
        </div>
      </aside>

      <div className="cooperative-main">
        {(virtualAccount?.accountNumber || cooperative?.nombaVirtualAccountNumber || cooperative?.nombaVirtualAccountRef) && (
          <section className="trust-card page-reveal" style={{ background: 'var(--surface-raised)', border: '2px solid var(--accent)' }}>
            <div className="trust-card__body" style={{ width: '100%' }}>
              <div className="eyebrow" style={{ color: 'var(--accent)' }}>Nomba Virtual Account - Send Money Here</div>
              <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: 3, fontFamily: 'monospace', marginTop: 8 }}>
                {virtualAccount?.accountNumber ?? cooperative?.nombaVirtualAccountNumber ?? cooperative?.nombaVirtualAccountRef}
              </div>
              <div style={{ marginTop: 4, opacity: 0.75 }}>
                {virtualAccount?.bankName ?? 'Nomba'}
              </div>
              <p style={{ marginTop: 12, fontSize: 13 }}>
                Transfer real NGN to this account number from any Nigerian banking app (GTB, Access, Zenith, etc.).
                The cooperative balance updates automatically within 60 seconds via the Nomba transaction sync.
                <strong> The treasurer cannot withdraw this money directly</strong> — every payout requires multi-signature approval.
              </p>
              <StatusPill tone="success">LIVE REAL MONEY</StatusPill>
            </div>
          </section>
        )}

        {error && (
          <div className="callout page-reveal">
            {error}
            <button className="button button--ghost" style={{ marginTop: 12 }} onClick={() => void loadCooperative()}>
              Retry Cooperative
            </button>
          </div>
        )}

        <section className="trust-card page-reveal">
          <div className="trust-card__gauge">
            <div className="score-ring score-ring--large">
              <span>{cooperative?.healthScore ?? 0}</span>
              <small>{scoreLabel}</small>
            </div>
          </div>
          <div className="trust-card__body">
            <div className="eyebrow">Treasury Position</div>
            <p>
              {cooperative
                ? 'This cooperative is tied to a real Nomba virtual account and an active treasury record.'
                : loading
                  ? 'Loading cooperative treasury details.'
                  : 'No cooperative data loaded yet.'}
            </p>
          </div>
          <div className="trust-card__bars">
            {cooperative?.scoreBreakdown?.length ? (
              cooperative.scoreBreakdown.map((item, index) => (
                <div key={item.label} className="bar-row bar-row--interactive">
                  <span>{item.label}</span>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${trustValues[index]}%` }} />
                  </div>
                  <strong>{item.value}/100</strong>
                </div>
              ))
            ) : (
              <p className="empty-state">{loading ? 'Loading score breakdown...' : 'No score breakdown yet.'}</p>
            )}
          </div>
        </section>

        <SectionCard
          title="Trust Performance History"
          subtitle="Live comparison against the current cooperative trajectory."
          className="page-reveal"
        >
          {cooperative?.trustHistory?.length ? (
            <BarChart values={cooperative.trustHistory} greenFrom={8} />
          ) : (
            <p className="empty-state">{loading ? 'Loading trust history...' : 'No trust history yet.'}</p>
          )}
        </SectionCard>

        <SectionCard
          title="Live Audit Feed"
          subtitle="Transaction history is anchored and redacted for public display."
          actions={<StatusPill tone="soft">LIVE ENCRYPTION ACTIVE</StatusPill>}
          className="page-reveal"
        >
          <AuditLogPanel cooperativeId={cooperativeId} />
        </SectionCard>
      </div>
    </div>
  );
}
