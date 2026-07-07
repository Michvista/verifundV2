import { useEffect, useState } from 'react';
import { Metric } from '../components/Metric';
import { SectionCard } from '../components/SectionCard';
import { StatusPill } from '../components/StatusPill';
import { Sparkline } from '../components/Sparkline';
import { NombaOperationsPanel } from '../components/NombaOperationsPanel';
import { ACTIVE_COOPERATIVE_EVENT } from '../components/Shell';
import { useAuth } from '../auth/AuthContext';
import { readStorage } from '../services/browserStorage';
import {
  getDashboard,
  submitContribution,
  type DashboardResponse,
  type NombaCronStatus,
} from '../services/api';

type WsStatus = 'idle' | 'connected' | 'disconnected';

function loadCooperativeId() {
  return readStorage('verifund_cooperative_id') || '';
}

function formatNaira(value: number | string | undefined) {
  const parsed = typeof value === 'string' ? Number(value.replace(/[^0-9.]/g, '')) : Number(value ?? 0);
  const safeValue = Number.isFinite(parsed) ? parsed : 0;
  return `₦${safeValue.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
}

export function DashboardPage() {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [cooperativeId, setCooperativeId] = useState(loadCooperativeId);
  const [liveFeed, setLiveFeed] = useState<DashboardResponse['activityFeed']>([]);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [cronStatus, setCronStatus] = useState<NombaCronStatus | null>(null);
  const [wsStatus, setWsStatus] = useState<WsStatus>('idle');
  const [contributionAmount, setContributionAmount] = useState('20000');
  const [expectedContribution, setExpectedContribution] = useState('20000');
  const [contributionLoading, setContributionLoading] = useState(false);
  const [contributionMsg, setContributionMsg] = useState<string | null>(null);

  async function refresh() {
    if (!cooperativeId) {
      setDashboard(null);
      setLiveFeed([]);
      return;
    }
    setDashboardLoading(true);
    setDashboardError(null);
    try {
      const data = await getDashboard(cooperativeId);
      setDashboard(data);
      setLiveFeed(data.activityFeed);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Dashboard could not be loaded.';
      setDashboard(null);
      setLiveFeed([]);
      setDashboardError(message);
    } finally {
      setDashboardLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, [cooperativeId]);

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
    if (!cooperativeId) return;

    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:5050/ws';
    let socket: WebSocket;

    try {
      socket = new WebSocket(wsUrl);
    } catch {
      setWsStatus('disconnected');
      return;
    }

    setWsStatus('idle');

    socket.onopen = () => setWsStatus('connected');
    socket.onerror = () => setWsStatus('disconnected');
    socket.onclose = () => setWsStatus('disconnected');

    socket.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data as string) as {
          type?: string;
          message?: string;
          timestamp?: string;
        };
        const type = parsed.type || 'realtime-event';
        const timestamp = parsed.timestamp || new Date().toISOString();

        setLiveFeed((current) =>
          [
            {
              id: `${type}-${timestamp}`,
              title: type.replace(/-/g, ' '),
              text: parsed.message || 'Realtime update received.',
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
        className="page-reveal"
      >
        <p className="empty-state">Select a cooperative to view its dashboard.</p>
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
            className="page-reveal"
          >
            <div className="detail-grid">
              <div>
                <span>Active Cooperative</span>
                <strong>{cooperativeId}</strong>
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

          <NombaOperationsPanel
            cooperativeId={cooperativeId}
            onStatusChange={setCronStatus}
            onSynced={refresh}
          />

          <section className="loan-card page-reveal">
            <div className="eyebrow">Current Loan Status</div>
            <div className="loan-card__amount">
              {dashboard?.loanStatus?.toUpperCase() ?? 'LOADING...'}
            </div>
            <StatusPill tone="success">
              {dashboard?.loanStatus?.toUpperCase() ?? 'ELIGIBLE'}
            </StatusPill>
          </section>

          <SectionCard
            title="Live Activity Feed"
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
