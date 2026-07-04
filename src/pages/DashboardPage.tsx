import { useEffect, useState } from 'react';
import { contributionTrend } from '../data';
import { Metric } from '../components/Metric';
import { SectionCard } from '../components/SectionCard';
import { StatusPill } from '../components/StatusPill';
import { Sparkline } from '../components/Sparkline';
import { getDashboard, type DashboardResponse } from '../services/api';

function loadCooperativeId() {
  return localStorage.getItem('verifund_cooperative_id') || '';
}

export function DashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [cooperativeId] = useState(loadCooperativeId);
  const [liveFeed, setLiveFeed] = useState<DashboardResponse['activityFeed']>([]);

  useEffect(() => {
    if (!cooperativeId) return;
    void getDashboard(cooperativeId)
      .then((data) => {
        setDashboard(data);
        setLiveFeed(data.activityFeed);
      })
      .catch(() => setDashboard(null));
  }, [cooperativeId]);

  useEffect(() => {
    if (!cooperativeId) return;

    const apiBase =
      import.meta.env.VITE_API_BASE_URL || 'http://localhost:5050/api';
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
  const trend = dashboard?.contributionTrend?.length ? dashboard.contributionTrend : contributionTrend;

  return (
    <div className="page-grid">
      <div className="main-stack">
        <section className="hero-card page-reveal">
          <div className="hero-card__copy">
            <div className="eyebrow">Your Cooperative Balance</div>
            <div className="balance">
              {dashboard
                ? `₦ ${dashboard.balance.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`
                : 'Loading balance...'}
            </div>
            <div className="hero-card__meta">
              <Metric
                label="Next Contribution"
                value={dashboard?.nextContribution ?? 'Loading...'}
              />
              <Metric
                label="Membership Tenure"
                value={dashboard?.tenure ?? 'Loading...'}
              />
              <Metric
                label="Trust Score"
                value={dashboard ? String(dashboard.trustScore) : '...'}
                caption="Live"
              />
            </div>
          </div>

          <div className="hero-card__chart">
            <div className="score-ring">
              <span>{dashboard?.trustScore ?? 0}</span>
              <small>{dashboard ? 'Live' : 'Idle'}</small>
            </div>
            <div className="hero-card__note">
              Cooperative funds sit in a dedicated Nomba virtual account. No treasurer can touch
              cash directly.
            </div>
            <Sparkline
              values={trend}
              stroke="#0d7c66"
              fill="rgba(13,124,102,0.18)"
              label="Contribution trend"
            />
          </div>
        </section>

        <SectionCard
          title="Contribution History"
          subtitle="Ledger-style passbook view with downloadable records."
          actions={<button className="button button--ghost">Download PDF Ledger</button>}
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
                  <span>{`₦${row.amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`}</span>
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
              No contributions have been recorded yet for this cooperative.
            </p>
          )}

          <div className="callout callout--alert">Report suspicious activity</div>
        </SectionCard>
      </div>

      <aside className="side-stack">
        <section className="loan-card page-reveal">
          <div className="eyebrow">Current Loan Status</div>
          <div className="loan-card__amount">{dashboard ? '₦0.00' : 'Loading...'}</div>
          <StatusPill tone="success">{dashboard?.loanStatus?.toUpperCase() ?? 'ELIGIBLE'}</StatusPill>
          <button className="button button--light">Apply for Credit</button>
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

        <div className="tip-card page-reveal">
          <div className="eyebrow">Treasury Rule</div>
          <h3>Real contributions, real audit trail, no demo shortcuts.</h3>
        </div>
      </aside>
    </div>
  );
}
