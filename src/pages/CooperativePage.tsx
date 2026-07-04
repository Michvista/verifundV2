import { useEffect, useState } from 'react';
import { Metric } from '../components/Metric';
import { SectionCard } from '../components/SectionCard';
import { StatusPill } from '../components/StatusPill';
import { BarChart } from '../components/BarChart';
import { getCooperative, type CooperativeResponse } from '../services/api';

function loadCooperativeId() {
  return localStorage.getItem('verifund_cooperative_id') || '';
}

export function CooperativePage() {
  const [cooperativeId] = useState(loadCooperativeId);
  const [cooperative, setCooperative] = useState<CooperativeResponse | null>(null);

  useEffect(() => {
    if (!cooperativeId) return;
    void getCooperative(cooperativeId).then(setCooperative).catch(() => setCooperative(null));
  }, [cooperativeId]);

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

  return (
    <div className="cooperative-layout">
      <aside className="identity-panel page-reveal">
        <div className="eyebrow">Entity Identity</div>
        <h2>{cooperative?.name ?? cooperativeId}</h2>
        <p>{cooperative?.state ?? 'Live cooperative record'}</p>
        <div className="identity-panel__meta">
          <Metric label="Registration" value={cooperative?.registrationNumber ?? cooperativeId} />
          <Metric
            label="Member Count"
            value={cooperative ? `${cooperative.memberCount.toLocaleString()} Active` : 'Loading...'}
          />
        </div>
        <div className="seal">VERIFUND CERTIFIED</div>
        <div className="stacked-actions">
          <button className="button button--primary button--full">Export Full Report</button>
          <button className="button button--ghost button--full">Share Link</button>
        </div>
      </aside>

      <div className="cooperative-main">
        <section className="trust-card page-reveal">
          <div className="trust-card__gauge">
            <div className="score-ring score-ring--large">
              <span>{cooperative?.healthScore ?? 0}</span>
              <small>{cooperative ? 'Live' : 'Idle'}</small>
            </div>
          </div>
          <div className="trust-card__body">
            <div className="eyebrow">Treasury Position</div>
            <p>
              {cooperative
                ? 'This cooperative is tied to a real Nomba virtual account and an active treasury record.'
                : 'No cooperative data loaded yet.'}
            </p>
          </div>
          <div className="trust-card__bars">
            {(cooperative?.scoreBreakdown ?? []).map((item, index) => (
              <div key={item.label} className="bar-row bar-row--interactive">
                <span>{item.label}</span>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${trustValues[index]}%` }} />
                </div>
                <strong>{item.value}/100</strong>
              </div>
            ))}
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
            <p className="empty-state">No trust history yet.</p>
          )}
        </SectionCard>

        <SectionCard
          title="Live Audit Feed"
          subtitle="Transaction history is anchored and redacted for public display."
          actions={<StatusPill tone="soft">LIVE ENCRYPTION ACTIVE</StatusPill>}
          className="page-reveal"
        >
          <p className="empty-state">Audit events will appear after the first live transaction.</p>
        </SectionCard>
      </div>
    </div>
  );
}
