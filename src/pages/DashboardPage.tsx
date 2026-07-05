import { useEffect, useState } from 'react';
import { Metric } from '../components/Metric';
import { SectionCard } from '../components/SectionCard';
import { StatusPill } from '../components/StatusPill';
import { Sparkline } from '../components/Sparkline';
import { useAuth } from '../auth/AuthContext';
import {
  getDashboard,
  getNombaCronStatus,
  queueTestNombaCredit,
  runNombaCron,
  submitContribution,
  type DashboardResponse,
} from '../services/api';

type CronStatus = {
  running: boolean;
  lastRunAt: string;
  pendingCredits: number;
  pollIntervalMs: number;
  nombaConfigured: boolean;
};

type WsStatus = 'idle' | 'connected' | 'disconnected';

function loadCooperativeId() {
  return localStorage.getItem('verifund_cooperative_id') || '';
}

function formatNaira(value: number) {
  return `₦${value.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
}

export function DashboardPage() {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [cooperativeId] = useState(loadCooperativeId);
  const [liveFeed, setLiveFeed] = useState<DashboardResponse['activityFeed']>([]);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [cronStatus, setCronStatus] = useState<CronStatus | null>(null);
  const [cronLoading, setCronLoading] = useState(false);
  const [cronMsg, setCronMsg] = useState<string | null>(null);
  const [wsStatus, setWsStatus] = useState<WsStatus>('idle');
  const [testAmount, setTestAmount] = useState('25000');
  const [testRef, setTestRef] = useState('');
  const [contributionAmount, setContributionAmount] = useState('20000');
  const [expectedContribution, setExpectedContribution] = useState('20000');
  const [contributionLoading, setContributionLoading] = useState(false);
  const [contributionMsg, setContributionMsg] = useState<string | null>(null);

  async function refresh() {
    if (!cooperativeId) return;
    setDashboardLoading(true);
    setDashboardError(null);
    const data = await getDashboard(cooperativeId);
    setDashboard(data);
    setLiveFeed(data.activityFeed);
    setDashboardLoading(false);
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
    setDashboardLoading(true);
    setDashboardError(null);
    void refresh().catch((err) => {
      const message = err instanceof Error ? err.message : 'Dashboard could not be loaded.';
      setDashboard(null);
      setLiveFeed([]);
      setDashboardError(message);
      setDashboardLoading(false);
    });
    void refreshCronStatus();
  }, [cooperativeId]);

  useEffect(() => {
    if (!cooperativeId) return;

    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:5050/ws';
    const socket = new WebSocket(wsUrl);

    setWsStatus('idle');

    socket.onopen = () => setWsStatus('connected');
    socket.onerror = () => setWsStatus('disconnected');
    socket.onclose = () => setWsStatus('disconnected');

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
    setCronLoading(true);
    try {
      const result = await runNombaCron('manual');
      setCronMsg(
        `Cron sync ran: ${result.processedCredits} credit(s) processed from ${result.source}.`,
      );
      await refresh();
      await refreshCronStatus();
    } catch (err) {
      setCronMsg((err as Error).message);
    } finally {
      setCronLoading(false);
    }
  }

  async function handleQueueTestCredit() {
    if (!cooperativeId) return;
    const amount = Number(testAmount.replace(/[^0-9]/g, '') || 0);
    if (!amount) {
      setCronMsg('Enter a test amount before queueing a credit.');
      return;
    }

    setCronMsg(null);
    setCronLoading(true);
    try {
      const queued = await queueTestNombaCredit({
        cooperativeId,
        amount,
        nombaTransactionRef: testRef.trim() || undefined,
      });
      setCronMsg(`Queued test credit ${queued.credit.nombaTransactionRef}. Run cron sync to apply it.`);
      await refreshCronStatus();
    } catch (err) {
      setCronMsg((err as Error).message);
    } finally {
      setCronLoading(false);
    }
  }

  async function handleSubmitContribution() {
    if (!cooperativeId || !user) {
      setContributionMsg('Log in and select a cooperative before recording a contribution.');
      return;
    }

    const amount = Number(contributionAmount.replace(/[^0-9]/g, '') || 0);
    const expectedAmount = Number(expectedContribution.replace(/[^0-9]/g, '') || 0);

    if (!amount) {
      setContributionMsg('Enter a contribution amount before submitting.');
      return;
    }

    setContributionLoading(true);
    setContributionMsg(null);
    try {
      const response = await submitContribution({
        memberId: user.id,
        cooperativeId,
        amount,
        expectedAmount: expectedAmount || undefined,
      });
      const score = Math.round(response.result.riskScore * 100);
      setContributionMsg(
        `Contribution recorded: ${response.result.riskCategory.toUpperCase()} risk (${score}/100).`,
      );
      setContributionAmount('20000');
      await refresh();
    } catch (err) {
      setContributionMsg(err instanceof Error ? err.message : 'Contribution could not be recorded.');
    } finally {
      setContributionLoading(false);
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
  const isInitialLoading = dashboardLoading && !dashboard;

  return (
    <div className="dashboard-layout">
      <section className="hero-card page-reveal">
        <div className="hero-card__copy">
          <div className="eyebrow">Treasury Overview</div>
          <div className="balance">
            {dashboard ? formatNaira(dashboard.balance) : isInitialLoading ? 'Loading balance...' : 'Balance unavailable'}
          </div>
          <div className="hero-card__meta">
            <Metric label="Next Contribution" value={dashboard?.nextContribution ?? (isInitialLoading ? 'Loading...' : 'Unavailable')} />
            <Metric label="Membership Tenure" value={dashboard?.tenure ?? (isInitialLoading ? 'Loading...' : 'Unavailable')} />
            <Metric label="Trust Score" value={dashboard ? String(dashboard.trustScore) : '...'} caption="Live" />
          </div>
          {dashboardError && (
            <div className="callout" style={{ marginTop: 18 }}>
              {dashboardError}
              <button className="button button--ghost" style={{ marginTop: 12 }} onClick={() => void refresh()}>
                Retry Dashboard
              </button>
            </div>
          )}
        </div>

        <div className="hero-card__chart">
          <div className="score-ring">
            <span>{dashboard?.trustScore ?? 0}</span>
            <small>{dashboard ? 'Live' : isInitialLoading ? 'Loading' : 'Idle'}</small>
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
              <p className="empty-state">
                {isInitialLoading
                  ? 'Loading contribution history...'
                  : 'No contributions have been recorded yet for this cooperative.'}
              </p>
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
                <strong>{cronStatus?.running ? 'Running' : cronStatus ? 'Idle' : 'Unavailable'}</strong>
              </div>
              <div>
                <span>Pending Credits</span>
                <strong>{cronStatus?.pendingCredits ?? 0}</strong>
              </div>
              <div>
                <span>Realtime Feed</span>
                <strong>{wsStatus === 'connected' ? 'Connected' : wsStatus === 'idle' ? 'Connecting' : 'Offline'}</strong>
              </div>
            </div>
          </SectionCard>
        </div>

        <aside className="side-stack">
          <section className="deposit-panel page-reveal">
            <div className="eyebrow">Manual Contribution</div>
            <h2>Record member payment</h2>
            <p>
              Use this for demo and admin-tested contribution ingestion. Live payment credits should
              still flow through Nomba sync.
            </p>

            <label className="input-block">
              <span>Contribution Amount (NGN)</span>
              <input
                value={contributionAmount}
                onChange={(e) => setContributionAmount(e.target.value)}
                inputMode="numeric"
              />
            </label>

            <label className="input-block">
              <span>Expected Amount (NGN)</span>
              <input
                value={expectedContribution}
                onChange={(e) => setExpectedContribution(e.target.value)}
                inputMode="numeric"
              />
            </label>

            {contributionMsg && <div className="notice" style={{ marginTop: 12 }}>{contributionMsg}</div>}

            <button
              className="button button--primary button--full"
              style={{ marginTop: 16 }}
              disabled={contributionLoading || !user}
              onClick={() => void handleSubmitContribution()}
            >
              {contributionLoading ? 'Recording...' : 'Record Contribution'}
            </button>
          </section>

          <section className="deposit-panel page-reveal">
            <div className="eyebrow">Cron Sync</div>
            <h2>Reconcile incoming money</h2>
            <p>
              To fund this cooperative, transfer real NGN from any banking app
              to the virtual account number shown on the <strong>Cooperative</strong> page.
              The balance here updates automatically every 60 seconds, or click below to
              check immediately.
            </p>

            <div className="detail-grid" style={{ marginTop: 12 }}>
              <div>
                <span>Cron Status</span>
                <strong>{cronStatus?.running ? 'Running' : 'Idle'}</strong>
              </div>
              <div>
                <span>Last Sync</span>
                <strong>{cronStatus?.lastRunAt ? new Date(cronStatus.lastRunAt).toLocaleTimeString() : 'Not yet run'}</strong>
              </div>
              <div>
                <span>Nomba Connected</span>
                <strong>{cronStatus?.nombaConfigured ? 'Live' : 'Not configured'}</strong>
              </div>
            </div>

            {cronMsg && <div className="notice" style={{ marginTop: 12 }}>{cronMsg}</div>}

            <label className="input-block">
              <span>Test Credit Amount (NGN)</span>
              <input value={testAmount} onChange={(e) => setTestAmount(e.target.value)} inputMode="numeric" />
            </label>

            <label className="input-block">
              <span>Optional Reference</span>
              <input value={testRef} onChange={(e) => setTestRef(e.target.value)} placeholder="Leave blank to auto-generate" />
            </label>

            <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
              <button
                className="button button--primary button--full"
                disabled={cronLoading}
                onClick={() => void handleQueueTestCredit()}
              >
                {cronLoading ? 'Working...' : 'Queue Test Credit'}
              </button>
              <button
                className="button button--ghost button--full"
                disabled={cronLoading}
                onClick={() => void handleRunCron()}
              >
                {cronLoading ? 'Working...' : 'Run Cron Sync Now'}
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
              <p className="empty-state">
                {isInitialLoading ? 'Loading activity feed...' : 'No live activity yet.'}
              </p>
            )}
          </SectionCard>
        </aside>
      </div>
    </div>
  );
}
