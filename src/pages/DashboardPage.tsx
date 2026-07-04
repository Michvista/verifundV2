import { useEffect, useState } from 'react';
import { Metric } from '../components/Metric';
import { SectionCard } from '../components/SectionCard';
import { StatusPill } from '../components/StatusPill';
import { Sparkline } from '../components/Sparkline';
import {
  getDashboard,
  getNombaCronStatus,
  queueTestNombaCredit,
  runNombaCron,
  type DashboardResponse,
} from '../services/api';

type UserProfile = {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
};

function loadCooperativeId() {
  return localStorage.getItem('verifund_cooperative_id') || '';
}

function loadUser(): UserProfile | null {
  try {
    const raw = localStorage.getItem('verifund_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function formatNaira(value: number) {
  return `₦${value.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
}

export function DashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [cooperativeId] = useState(loadCooperativeId);
  const [user] = useState(loadUser);
  const [liveFeed, setLiveFeed] = useState<DashboardResponse['activityFeed']>([]);
  const [cronStatus, setCronStatus] = useState<{
    running: boolean;
    lastRunAt: string;
    pendingCredits: number;
    pollIntervalMs: number;
    nombaConfigured: boolean;
  } | null>(null);
  const [cronMsg, setCronMsg] = useState<string | null>(null);
  const [testAmount, setTestAmount] = useState('25000');
  const [testRef, setTestRef] = useState('');

  async function refresh() {
    if (!cooperativeId) return;
    const data = await getDashboard(cooperativeId);
    setDashboard(data);
    setLiveFeed(data.activityFeed);
  }

  async function refreshCronStatus() {
    try {
      setCronStatus(await getNombaCronStatus());
    } catch {
      setCronStatus(null);
    }
  }

  useEffect(() => {
    if (!cooperativeId) return;
    void refresh().catch(() => setDashboard(null));
    void refreshCronStatus();
  }, [cooperativeId]);

  useEffect(() => {
    if (!cooperativeId) return;

    const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5050/api';
    const wsUrl = apiBase.replace(/^http/, 'ws').replace(/\/api\/?$/, '') + '/ws';
    const socket = new WebSocket(wsUrl);

    socket.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data as string) as {
          type: string;
          message: string;
          timestamp: string;
        };
        setLiveFeed((current) =>
          [
            {
              id: `${parsed.type}-${parsed.timestamp}`,
              title: parsed.type.replace(/-/g, ' '),
              text: parsed.message,
              time: 'just now',
            },
            ...current,
          ].slice(0, 6),
        );
      } catch {
        // Ignore malformed realtime events.
      }
    };

    return () => socket.close();
  }, [cooperativeId]);

  async function handleRunCron() {
    setCronMsg(null);
    try {
      const result = await runNombaCron('manual');
      setCronMsg(
        `Cron sync ran: ${result.processedCredits} credit(s) processed from ${result.source}.`,
      );
      await refresh();
      await refreshCronStatus();
    } catch (err) {
      setCronMsg((err as Error).message);
    }
  }

  async function handleQueueTestCredit() {
    if (!cooperativeId) return;
    setCronMsg(null);
    try {
      const queued = await queueTestNombaCredit({
        cooperativeId,
        amount: Number(testAmount.replace(/[^0-9]/g, '') || 0),
        nombaTransactionRef: testRef.trim() || undefined,
      });
      setCronMsg(`Queued test credit ${queued.credit.nombaTransactionRef}. Run cron sync to apply it.`);
      await refreshCronStatus();
    } catch (err) {
      setCronMsg((err as Error).message);
    }
  }

  if (!cooperativeId) {
    return (
      <SectionCard
        title="No cooperative selected"
        subtitle="Create a cooperative first, then load its dashboard here."
        className="page-reveal"
      >
        <p className="empty-state">
          Use the cooperative setup page to create a live treasury, then return here with the
          saved cooperative ID.
        </p>
      </SectionCard>
    );
  }

  const history = dashboard?.contributionHistory ?? [];
  const feed = liveFeed;
  const trend = dashboard?.contributionTrend ?? [];

  return (
    <div className="dashboard-layout">
      <section className="hero-card page-reveal">
        <div className="hero-card__copy">
          <div className="eyebrow">Treasury Overview</div>
          <div className="balance">
            {dashboard ? formatNaira(dashboard.balance) : 'Loading balance...'}
          </div>
          <div className="hero-card__meta">
            <Metric label="Next Contribution" value={dashboard?.nextContribution ?? 'Loading...'} />
            <Metric label="Membership Tenure" value={dashboard?.tenure ?? 'Loading...'} />
            <Metric label="Trust Score" value={dashboard ? String(dashboard.trustScore) : '...'} caption="Live" />
          </div>
        </div>

        <div className="hero-card__chart">
          <div className="score-ring">
            <span>{dashboard?.trustScore ?? 0}</span>
            <small>{dashboard ? 'Live' : 'Idle'}</small>
          </div>
          <div className="hero-card__note">
            Treasury credits are now reconciled by a cron sync instead of a webhook secret.
          </div>
          <Sparkline
            values={trend}
            stroke="#0d7c66"
            fill="rgba(13,124,102,0.18)"
            label="Contribution trend"
          />
        </div>
      </section>

      <div className="dashboard-grid">
        <div className="main-stack">
          <SectionCard
            title="Contribution History"
            subtitle="Ledger-style passbook view with live records only."
            className="page-reveal"
          >
            {history.length ? (
              <div className="table">
                <div className="table__head">
                  <span>Date</span>
                  <span>Amount</span>
                  <span>Status</span>
                  <span>Reference</span>
                </div>
                {history.map((row) => (
                  <div className="table__row table__row--interactive" key={row.reference}>
                    <span>{row.date}</span>
                    <span>{formatNaira(row.amount)}</span>
                    <span>
                      <StatusPill tone={row.status === 'confirmed' ? 'success' : 'neutral'}>
                        {row.status.toUpperCase()}
                      </StatusPill>
                    </span>
                    <span>{row.reference}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-state">No contributions have been recorded yet for this cooperative.</p>
            )}
          </SectionCard>

          <SectionCard
            title="Treasury Notes"
            subtitle="What the current balance means."
            className="page-reveal"
          >
            <div className="detail-grid">
              <div>
                <span>Active Cooperative</span>
                <strong>{cooperativeId}</strong>
              </div>
              <div>
                <span>Loaded User</span>
                <strong>{user ? `${user.firstName} ${user.lastName}` : 'Unknown'}</strong>
              </div>
              <div>
                <span>Cron Status</span>
                <strong>{cronStatus?.running ? 'Running' : 'Idle'}</strong>
              </div>
              <div>
                <span>Pending Credits</span>
                <strong>{cronStatus?.pendingCredits ?? 0}</strong>
              </div>
            </div>
          </SectionCard>
        </div>

        <aside className="side-stack">
          <section className="deposit-panel page-reveal">
            <div className="eyebrow">Cron Sync</div>
            <h2>Reconcile incoming money</h2>
            <p>
              Real balance updates should come from the scheduled Nomba sync. Use the controls below to
              test that path locally.
            </p>

            <label className="input-block">
              <span>Test Amount (NGN)</span>
              <input value={testAmount} onChange={(e) => setTestAmount(e.target.value)} inputMode="numeric" />
            </label>

            <label className="input-block">
              <span>Test Reference</span>
              <input value={testRef} onChange={(e) => setTestRef(e.target.value)} placeholder="Optional ref" />
            </label>

            {cronMsg && <div className="notice" style={{ marginTop: 12 }}>{cronMsg}</div>}

            <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
              <button className="button button--primary button--full" onClick={() => void handleQueueTestCredit()}>
                Queue Test Credit
              </button>
              <button className="button button--ghost button--full" onClick={() => void handleRunCron()}>
                Run Cron Sync Now
              </button>
            </div>
          </section>

          <section className="loan-card page-reveal">
            <div className="eyebrow">Current Loan Status</div>
            <div className="loan-card__amount">
              {dashboard?.loanStatus?.toUpperCase() ?? 'LOADING...'}
            </div>
            <StatusPill tone="success">
              {dashboard?.loanStatus?.toUpperCase() ?? 'ELIGIBLE'}
            </StatusPill>
            <p>Loan controls are scored elsewhere. This view stays read-only until approval.</p>
          </section>

          <SectionCard
            title="Live Activity Feed"
            subtitle="Recent cooperative events and verification updates."
            className="page-reveal"
          >
            {feed.length ? (
              <div className="feed">
                {feed.map((item) => (
                  <div className="feed__item feed__item--interactive" key={item.id}>
                    <div className="feed__icon" />
                    <div>
                      <div className="feed__title">{item.title}</div>
                      <p>{item.text}</p>
                      <small>{item.time}</small>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-state">No live activity yet.</p>
            )}
          </SectionCard>
        </aside>
      </div>
    </div>
  );
}
