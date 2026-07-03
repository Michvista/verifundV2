import { Metric } from '../components/Metric';
import { SectionCard } from '../components/SectionCard';
import { StatusPill } from '../components/StatusPill';

export function CooperativePage() {
  const values = [95, 88, 91, 100, 85];

  return (
    <div className="cooperative-layout">
      <aside className="identity-panel page-reveal">
        <div className="eyebrow">Entity Identity</div>
        <h2>Okafor Farmers Thrift & Credit</h2>
        <p>Lagos, Nigeria</p>
        <div className="identity-panel__meta">
          <Metric label="Registration" value="2024-X99" />
          <Metric label="Member Count" value="1,248 Verified" />
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
              <span>92</span>
              <small>Excellent</small>
            </div>
          </div>
          <div className="trust-card__body">
            <div className="eyebrow">Trust Score Index</div>
            <p>This cooperative maintains a 98% timely contribution rate and has no outstanding dispute records.</p>
          </div>
          <div className="trust-card__bars">
            {['Member Verification', 'Contribution Regularity', 'Loan Liquidity', 'Governance Transparency', 'External Audit Status'].map((label, index) => (
              <div key={label} className="bar-row bar-row--interactive">
                <span>{label}</span>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${values[index]}%` }} />
                </div>
                <strong>{values[index]}/100</strong>
              </div>
            ))}
          </div>
        </section>

        <SectionCard title="Trust Performance History (12 Mo)" subtitle="Live comparison against VeriFund average." className="page-reveal">
          <div className="bar-chart">
            {[58, 60, 59, 64, 68, 67, 71, 74, 77, 80, 82, 84].map((value, index) => (
              <div key={index} className={`bar-chart__bar ${index > 8 ? 'bar-chart__bar--green' : ''}`} style={{ height: `${value * 1.5}px` }} />
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Live Audit Feed (Masked)"
          subtitle="Transaction history is cryptographically anchored and partially redacted."
          actions={<StatusPill tone="soft">LIVE ENCRYPTION ACTIVE</StatusPill>}
          className="page-reveal"
        >
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
                <span><StatusPill tone="success">Verified</StatusPill></span>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
