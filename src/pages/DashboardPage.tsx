import { useEffect, useState } from "react";
import { contributionTrend } from "../data";
import { Metric } from "../components/Metric";
import { SectionCard } from "../components/SectionCard";
import { StatusPill } from "../components/StatusPill";
import { Sparkline } from "../components/Sparkline";
import { getDashboard, type DashboardResponse } from "../services/api";

export function DashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [liveFeed, setLiveFeed] = useState(dashboard?.activityFeed ?? []);

  useEffect(() => {
    void getDashboard().then(setDashboard);
  }, []);

  useEffect(() => {
    if (!dashboard) return;
    setLiveFeed(dashboard.activityFeed);
  }, [dashboard]);

  useEffect(() => {
    const apiBase =
      import.meta.env.VITE_API_BASE_URL || "http://localhost:5050/api";
    const wsUrl =
      apiBase.replace(/^http/, "ws").replace(/\/api\/?$/, "") + "/ws";
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
              title: parsed.type.replace(/-/g, " "),
              text: parsed.message,
              time: "just now",
            },
            ...current,
          ].slice(0, 6),
        );
      } catch {
        // Ignore malformed demo events.
      }
    };

    return () => socket.close();
  }, []);

  const history = dashboard?.contributionHistory ?? [];
  const feed = liveFeed;
  const trend = dashboard?.contributionTrend ?? contributionTrend;

  return (
    <div className="page-grid">
      <div className="main-stack">
        <section className="hero-card page-reveal">
          <div className="hero-card__copy">
            <div className="eyebrow">Your Cooperative Balance</div>
            <div className="balance">
              {dashboard
                ? `₦ ${dashboard.balance.toLocaleString("en-NG", { minimumFractionDigits: 2 })}`
                : "Loading balance..."}
            </div>
            <div className="hero-card__meta">
              <Metric
                label="Next Contribution"
                value={dashboard?.nextContribution ?? "Loading..."}
              />
              <Metric
                label="Membership Tenure"
                value={dashboard?.tenure ?? "Loading..."}
              />
              <Metric
                label="Trust Score"
                value={dashboard ? String(dashboard.trustScore) : "..."}
                caption="Excellent"
              />
            </div>
          </div>

          <div className="hero-card__chart">
            <div className="score-ring">
              <span>{dashboard?.trustScore ?? 92}</span>
              <small>Excellent</small>
            </div>
            <div className="hero-card__note">
              Cooperative funds are ring-fenced in a dedicated Nomba virtual
              account. No treasurer can touch cash directly.
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
          actions={
            <button className="button button--ghost">
              Download PDF Ledger
            </button>
          }
          className="page-reveal">
          <div className="table">
            <div className="table__head">
              <span>Date</span>
              <span>Amount</span>
              <span>Status</span>
              <span>Reference</span>
            </div>
            {history.map((row) => (
              <div
                className="table__row table__row--interactive"
                key={row.reference}>
                <span>{row.date}</span>
                <span>{`₦${row.amount.toLocaleString("en-NG", { minimumFractionDigits: 2 })}`}</span>
                <span>
                  <StatusPill
                    tone={row.status === "confirmed" ? "success" : "neutral"}>
                    {row.status.toUpperCase()}
                  </StatusPill>
                </span>
                <span>{row.reference}</span>
              </div>
            ))}
          </div>

          <div className="callout callout--alert">
            Report Suspicious Activity
          </div>
        </SectionCard>
      </div>

      <aside className="side-stack">
        <section className="loan-card page-reveal">
          <div className="eyebrow">Current Loan Status</div>
          <div className="loan-card__amount">
            {dashboard ? "₦0.00" : "Loading..."}
          </div>
          <StatusPill tone="success">
            {dashboard?.loanStatus?.toUpperCase() ?? "ELIGIBLE"}
          </StatusPill>
          <button className="button button--light">Apply for Credit</button>
        </section>

        <SectionCard
          title="Live Activity Feed"
          subtitle="Recent cooperative events and verification updates."
          className="page-reveal">
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
        </SectionCard>

        <div className="tip-card page-reveal">
          <div className="eyebrow">Passbook Tips</div>
          <h3>Secure your account with Multi-Factor Verification.</h3>
        </div>
      </aside>
    </div>
  );
}
