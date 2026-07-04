import { useEffect, useState } from 'react';
import { Metric } from '../components/Metric';
import { SectionCard } from '../components/SectionCard';
import { StatusPill } from '../components/StatusPill';
import { Sparkline } from '../components/Sparkline';
import { getDashboard, submitContribution, type DashboardResponse } from '../services/api';

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
  const [depositAmount, setDepositAmount] = useState('');
  const [depositLoading, setDepositLoading] = useState(false);
  const [depositMsg, setDepositMsg] = useState<string | null>(null);

  async function refresh() {
    if (!cooperativeId) return;
    const data = await getDashboard(cooperativeId);
    setDashboard(data);
    setLiveFeed(data.activityFeed);
  }

  useEffect(() => {
    if (!cooperativeId) return;
    void refresh().catch(() => setDashboard(null));
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

  async function handleDeposit() {
    const amount = Number(depositAmount.replace(/[^0-9]/g, '') || 0);
    if (!cooperativeId || !user || !amount) return;

    setDepositLoading(true);
    setDepositMsg(null);
    try {
      await submitContribution({
        cooperativeId,
        memberId: user.id,
        amount,
      });
      setDepositMsg(`Contribution recorded: ${formatNaira(amount)}.`);
      setDepositAmount('');
      await refresh();
    } catch (err) {
      setDepositMsg((err as Error).message);
    } finally {
      setDepositLoading(false);
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
                No contributions have been recorded yet for this cooperative.
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
            </div>
          </SectionCard>
        </div>

        <aside className="side-stack">
          <section className="deposit-panel page-reveal">
            <div className="eyebrow">Drop Money</div>
            <h2>Record a contribution</h2>
            <p>Use this to credit the cooperative balance during local testing.</p>

            <label className="input-block">
              <span>Amount (NGN)</span>
              <input
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                inputMode="numeric"
                placeholder="Enter amount"
              />
            </label>

            {depositMsg && <div className="notice" style={{ marginTop: 12 }}>{depositMsg}</div>}

            <button
              className="button button--primary button--full"
              style={{ marginTop: 16 }}
              disabled={depositLoading || !depositAmount.trim()}
              onClick={() => void handleDeposit()}
            >
              {depositLoading ? 'Recording...' : 'Credit Balance'}
            </button>
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
