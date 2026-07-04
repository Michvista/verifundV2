import { useEffect, useState } from 'react';
import { StatusPill } from '../components/StatusPill';
import { BarChart } from '../components/BarChart';
import { getTrustScore, type TrustScoreResponse } from '../services/api';

function loadCooperativeId() {
  return localStorage.getItem('verifund_cooperative_id') || '';
}

export function TrustScorePage() {
  const [trustScore, setTrustScore] = useState<TrustScoreResponse | null>(null);
  const [cooperativeId] = useState(loadCooperativeId);

  useEffect(() => {
    if (!cooperativeId) return;
    void getTrustScore(cooperativeId).then(setTrustScore).catch(() => setTrustScore(null));
  }, [cooperativeId]);

  if (!cooperativeId) {
    return (
      <section className="note-panel page-reveal">
        Create or select a cooperative first, then load its trust score here.
      </section>
    );
  }

  const score = trustScore?.score ?? 0;
  const breakdown = trustScore?.scoreBreakdown ?? [];
  const history = trustScore?.history ?? [];

  return (
    <div className="trust-page">
      <aside className="trust-page__sidebar page-reveal">
        <div className="eyebrow">Entity Identity</div>
        <h2>{trustScore?.name ?? cooperativeId}</h2>
        <div className="trust-page__location">Live cooperative record</div>
        <div className="mini-sections">
          <div>
            <span>Registration</span>
            <strong>{cooperativeId}</strong>
          </div>
        </div>
        <div className="seal">VERIFUND CERTIFIED</div>
        <button className="button button--primary button--full">Export Full Report</button>
        <button className="button button--ghost button--full">Share Link</button>
      </aside>

      <div className="trust-page__main">
        <section className="trust-score-panel page-reveal">
          <div className="trust-score-panel__left">
            <div className="eyebrow">Trust Score Index</div>
            <div className="score-ring score-ring--xl">
              <span>{score}</span>
              <small>{score >= 80 ? 'Excellent' : score >= 60 ? 'Fair' : 'Watch'}</small>
            </div>
            <p>
              {trustScore?.summary ?? 'No trust score has been generated yet for this cooperative.'}
            </p>
          </div>

          <div className="trust-score-panel__right">
            <div className="eyebrow">Score Breakdown</div>
            {breakdown.length ? (
              breakdown.map((bar) => (
                <div key={bar.label} className="bar-row bar-row--interactive">
                  <span>{bar.label}</span>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${bar.value}%` }} />
                  </div>
                  <strong>{bar.value}/100</strong>
                </div>
              ))
            ) : (
              <p className="empty-state">No breakdown available yet.</p>
            )}
          </div>
        </section>

        <section className="history-panel page-reveal">
          <div className="section-card__header">
            <div>
              <h2>Trust Performance History</h2>
              <p>Live history from the cooperative trust engine.</p>
            </div>
            <StatusPill tone="soft">LIVE</StatusPill>
          </div>
          {history.length ? <BarChart values={history} greenFrom={10} /> : <p className="empty-state">No history yet.</p>}
        </section>

        <section className="audit-panel page-reveal">
          <div className="section-card__header">
            <div>
              <h2>Live Audit Feed</h2>
              <p>Anchored to the VeriFund ledger.</p>
            </div>
            <StatusPill tone="soft">LIVE ENCRYPTION ACTIVE</StatusPill>
          </div>
          <p className="empty-state">Audit rows will appear once the cooperative starts transacting.</p>
        </section>

        <section className="note-panel page-reveal">
          The trust score is only meaningful when it is computed from real cooperative activity.
        </section>
      </div>
    </div>
  );
}
