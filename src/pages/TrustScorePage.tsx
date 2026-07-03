import { useEffect, useState } from 'react';
import { StatusPill } from '../components/StatusPill';
import { BarChart } from '../components/BarChart';
import { getTrustScore, type TrustScoreResponse } from '../services/api';

export function TrustScorePage() {
  const [trustScore, setTrustScore] = useState<TrustScoreResponse | null>(null);

  useEffect(() => {
    void getTrustScore('okafor-farmers-thrift').then(setTrustScore);
  }, []);

  const score = trustScore?.score ?? 92;
  const breakdown = trustScore?.scoreBreakdown ?? [];
  const history = trustScore?.history ?? [42, 46, 50, 53, 58, 61, 70, 73, 72, 75, 78, 79];

  return (
    <div className="trust-page">
      <aside className="trust-page__sidebar page-reveal">
        <div className="eyebrow">Entity Identity</div>
        <h2>{trustScore?.name ?? 'Okafor Farmers Thrift & Credit'}</h2>
        <div className="trust-page__location">Lagos, Nigeria</div>
        <div className="mini-sections">
          <div>
            <span>Registration</span>
            <strong>2024-X99</strong>
          </div>
          <div>
            <span>Member Count</span>
            <strong>1,248 Verified</strong>
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
              <small>Excellent</small>
            </div>
            <p>{trustScore?.summary ?? 'This cooperative maintains a 98% timely contribution rate and has no outstanding dispute records.'}</p>
          </div>

          <div className="trust-score-panel__right">
            <div className="eyebrow">Score Breakdown</div>
            {breakdown.map((bar) => (
              <div key={bar.label} className="bar-row bar-row--interactive">
                <span>{bar.label}</span>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${bar.value}%` }} />
                </div>
                <strong>{bar.value}/100</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="history-panel page-reveal">
          <div className="section-card__header">
            <div>
              <h2>Trust Performance History (12 Mo)</h2>
              <p>VeriFund average compared with the cooperative’s current trajectory.</p>
            </div>
            <StatusPill tone="soft">DEC '24</StatusPill>
          </div>
          <BarChart values={history} greenFrom={10} />
        </section>

        <section className="audit-panel page-reveal">
          <div className="section-card__header">
            <div>
              <h2>Live Audit Feed (Masked)</h2>
              <p>Cryptographically anchored to the VeriFund ledger.</p>
            </div>
            <StatusPill tone="soft">LIVE ENCRYPTION ACTIVE</StatusPill>
          </div>
          <div className="table table--audit">
            <div className="table__head">
              <span>Timestamp</span>
              <span>Transaction Hash</span>
              <span>Amount</span>
              <span>Status</span>
            </div>
            {['2024-12-04 09:12:11', '2024-12-04 08:44:02', '2024-12-03 17:21:55', '2024-12-03 14:05:10', '2024-12-03 11:30:29'].map((time, index) => (
              <div className="table__row table__row--interactive" key={time}>
                <span>{time}</span>
                <span>0X...{['F8A12', 'B1C99', 'E22D4', '9A102', '55F1C'][index]}</span>
                <span>₦***,***.00</span>
                <span>
                  <StatusPill tone="success">Verified</StatusPill>
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="note-panel page-reveal">
          Official Verification Note: the data presented on this page is cryptographically anchored to the VeriFund ledger.
        </section>
      </div>
    </div>
  );
}
