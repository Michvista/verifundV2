import { useEffect, useMemo, useState } from 'react';
import { Metric } from '../components/Metric';
import { SectionCard } from '../components/SectionCard';
import { StatusPill } from '../components/StatusPill';
import { ACTIVE_COOPERATIVE_EVENT } from '../components/Shell';
import { getRiskDashboard, type RiskDashboardResponse } from '../services/api';

function loadCooperativeId() {
  return localStorage.getItem('verifund_cooperative_id') || '';
}

function toPercent(score: number) {
  return Math.round(score * 100);
}

function toneForCategory(category?: string) {
  if (category === 'high') return 'danger';
  if (category === 'medium') return 'warn';
  if (category === 'low') return 'success';
  return 'neutral';
}

export function RiskDashboardPage() {
  const [cooperativeId, setCooperativeId] = useState(loadCooperativeId);
  const [risk, setRisk] = useState<RiskDashboardResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadRiskDashboard() {
    if (!cooperativeId) return;

    setLoading(true);
    setError(null);
    try {
      setRisk(await getRiskDashboard(cooperativeId));
    } catch (err) {
      setRisk(null);
      setError(err instanceof Error ? err.message : 'Risk dashboard could not be loaded.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRiskDashboard();
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

  const score = risk ? toPercent(risk.riskScore) : 0;
  const contributionScore = risk ? toPercent(risk.contributionSignal.riskScore) : 0;
  const riskTone = useMemo(() => toneForCategory(risk?.riskCategory), [risk?.riskCategory]);
  const contributionTone = useMemo(
    () => toneForCategory(risk?.contributionSignal.riskCategory),
    [risk?.contributionSignal.riskCategory],
  );

  if (!cooperativeId) {
    return (
      <SectionCard
        title="AI Risk Dashboard"
        className="page-reveal"
      >
        <p className="empty-state">No cooperative selected.</p>
      </SectionCard>
    );
  }

  return (
    <div className="withdrawal-layout">
      <section className="risk-panel page-reveal">
        <div className="risk-panel__copy">
          <div className="risk-panel__grid">
            <div>
              <h2>{cooperativeId}</h2>
              <p style={{ color: 'var(--muted)', marginTop: 8 }}>Risk preview from the backend.</p>

              <div className="risk-meter">
                <div
                  className={`risk-meter__fill risk-meter__fill--${riskTone}`}
                  style={{ width: `${score}%` }}
                />
              </div>

              <div className="risk-panel__footer">
                <StatusPill tone={riskTone}>
                  {risk ? risk.riskCategory.toUpperCase() : loading ? 'LOADING' : 'IDLE'}
                </StatusPill>
                <span>{loading ? 'Loading backend risk...' : `Withdrawal risk ${score}/100`}</span>
              </div>

              {error && (
                <div className="callout" style={{ marginTop: 12 }}>
                  {error}
                  <button className="button button--ghost" style={{ marginTop: 12 }} onClick={() => void loadRiskDashboard()}>
                    Retry Risk Dashboard
                  </button>
                </div>
              )}
            </div>

            <div className="risk-panel__signals">
              <Metric label="Withdrawal Risk" value={`${score}/100`} caption={risk?.riskCategory ?? 'Waiting'} />
              <Metric
                label="Contribution Signal"
                value={`${contributionScore}/100`}
                caption={risk?.contributionSignal.riskCategory ?? 'Waiting'}
              />
              <Metric label="Signal Source" value="Backend" caption="GET /api/risk/:cooperativeId" />
            </div>
          </div>
        </div>
      </section>

      <SectionCard
        title="Risk Explanations"
        actions={<StatusPill tone={contributionTone}>CONTRIBUTIONS</StatusPill>}
        className="page-reveal"
      >
        {risk?.reasons.length ? (
          <ul className="insight-list">
            {risk.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        ) : (
          <p className="empty-state">
            {loading ? 'Loading...' : 'No reasons yet.'}
          </p>
        )}

        {risk?.contributionSignal.reasons.length ? (
          <div className="notice" style={{ marginTop: 14 }}>
            {risk.contributionSignal.reasons.join(' ')}
          </div>
        ) : (
          <p className="empty-state" style={{ marginTop: 14 }}>
            No contribution signal reasons yet.
          </p>
        )}
      </SectionCard>
    </div>
  );
}
