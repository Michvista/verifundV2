import { useEffect, useState } from 'react';
import { StatusPill } from '../components/StatusPill';
import { BarChart } from '../components/BarChart';
import { AuditLogPanel } from '../components/AuditLogPanel';
import { getTrustScore, type TrustScoreResponse } from '../services/api';
import { ACTIVE_COOPERATIVE_EVENT } from '../components/Shell';

function loadCooperativeId() {
  return localStorage.getItem('verifund_cooperative_id') || '';
}

export function TrustScorePage() {
  const [trustScore, setTrustScore] = useState<TrustScoreResponse | null>(null);
  const [cooperativeId, setCooperativeId] = useState(loadCooperativeId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadTrustScore() {
    if (!cooperativeId) return;

    setLoading(true);
    setError(null);
    try {
      setTrustScore(await getTrustScore(cooperativeId));
    } catch (err) {
      setTrustScore(null);
      setError(err instanceof Error ? err.message : 'Trust score could not be loaded.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTrustScore();
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
  const scoreStatus = trustScore ? (score >= 80 ? 'Excellent' : score >= 60 ? 'Fair' : 'Watch') : loading ? 'Loading' : 'Idle';

  return (
    <div className="trust-page">
      <aside className="trust-page__sidebar page-reveal">
        <div className="eyebrow">Entity Identity</div>
        <h2>{trustScore?.name ?? (loading ? 'Loading cooperative...' : cooperativeId)}</h2>
        <div className="trust-page__location">{loading ? 'Fetching trust score' : 'Live cooperative record'}</div>
        <div className="mini-sections">
          <div>
            <span>Registration</span>
            <strong>{cooperativeId}</strong>
          </div>
        </div>
        <div className="seal">VERIFUND CERTIFIED</div>
        <button className="button button--primary button--full" disabled>
          Export Full Report
        </button>
        <button className="button button--ghost button--full" disabled>
          Share Link
        </button>
      </aside>

      <div className="trust-page__main">
        {error && (
          <div className="callout page-reveal">
            {error}
            <button className="button button--ghost" style={{ marginTop: 12 }} onClick={() => void loadTrustScore()}>
              Retry Trust Score
            </button>
          </div>
        )}

        <section className="trust-score-panel page-reveal">
          <div className="trust-score-panel__left">
            <div className="eyebrow">Trust Score Index</div>
            <div className="score-ring score-ring--xl">
              <span>{score}</span>
              <small>{scoreStatus}</small>
            </div>
            <p>
              {trustScore?.summary ??
                (loading
                  ? 'Loading the latest trust score for this cooperative.'
                  : 'No trust score has been generated yet for this cooperative.')}
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
          {history.length ? (
            <BarChart values={history} greenFrom={10} />
          ) : (
            <p className="empty-state">{loading ? 'Loading score history...' : 'No history yet.'}</p>
          )}
        </section>

        <section className="audit-panel page-reveal">
          <div className="section-card__header">
            <div>
              <h2>Live Audit Feed</h2>
              <p>Anchored to the VeriFund ledger.</p>
            </div>
            <StatusPill tone="soft">LIVE ENCRYPTION ACTIVE</StatusPill>
          </div>
          <AuditLogPanel cooperativeId={cooperativeId} />
        </section>

        <section className="note-panel page-reveal">
          The trust score is only meaningful when it is computed from real cooperative activity.
        </section>
      </div>
    </div>
  );
}
