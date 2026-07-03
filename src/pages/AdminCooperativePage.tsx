export function AdminCooperativePage() {
  return (
    <div className="admin-grid">
      <section className="admin-panel page-reveal">
        <div className="eyebrow">Dashboard</div>
        <h2>Cooperative Balance</h2>
        <div className="admin-panel__balance">₦ 482,000.50</div>
        <div className="admin-panel__stats">
          <div>
            <span>Next Contribution</span>
            <strong>Jan 15, ₦20,000</strong>
          </div>
          <div>
            <span>Membership Tenure</span>
            <strong>14 Months Active</strong>
          </div>
          <div>
            <span>Trust Score</span>
            <strong>92 / Excellent</strong>
          </div>
        </div>
      </section>

      <section className="admin-panel admin-panel--dark page-reveal">
        <div className="eyebrow">Current Loan Status</div>
        <h2>Amount Owed</h2>
        <div className="admin-panel__balance">₦0.00</div>
        <div className="loan-badge">ELIGIBLE</div>
        <button className="button button--light button--full">Apply for Credit</button>
      </section>
    </div>
  );
}
