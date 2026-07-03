import { useState } from 'react';
import { submitWhistleblowerReport } from '../services/api';

export function WhistleblowerPage() {
  const [report, setReport] = useState('');
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [reportId, setReportId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!report.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await submitWhistleblowerReport({
        report: report.trim(),
        supportingDetails: details.trim() || undefined,
      });
      setReportId(result.whistleblowerReportId);
      setSubmitted(true);
    } catch (err) {
      setError((err as Error).message || 'Submission failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="whistle-layout">
        <section className="center-card page-reveal">
          <div className="eyebrow">Report Submitted</div>
          <h2>Thank you for your report</h2>
          <p>
            Your submission has been routed securely into the fraud triage queue.
            Reporter identity is masked by default — only the assigned regulator can
            access this report.
          </p>
          {reportId && (
            <div className="success-block" style={{ marginTop: 18 }}>
              <div className="success-block__row">
                <span>Reference ID</span>
                <strong style={{ fontFamily: 'monospace' }}>{reportId}</strong>
              </div>
            </div>
          )}
          <div className="notice" style={{ marginTop: 18 }}>
            Keep your Reference ID safe. You may use it to follow up with a regulator if needed.
          </div>
          <button
            className="button button--ghost button--full"
            style={{ marginTop: 16 }}
            onClick={() => { setSubmitted(false); setReport(''); setDetails(''); setReportId(null); }}
          >
            Submit another report
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="whistle-layout">
      <section className="center-card page-reveal">
        <div className="eyebrow">Anonymous Fraud Report</div>
        <h2>Submit concerns without revealing your identity</h2>
        <p>
          We'll route this through the fraud triage queue and mask reporter details by default.
          Your submission is encrypted end-to-end.
        </p>

        <label className="input-block">
          <span>What happened?</span>
          <textarea
            rows={5}
            placeholder="Describe the activity, date, and people involved…"
            value={report}
            onChange={(e) => setReport(e.target.value)}
          />
        </label>

        <label className="input-block">
          <span>Supporting details (optional)</span>
          <input
            placeholder="Transaction ref, cooperative name, or hash"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
          />
        </label>

        {error && (
          <div className="callout" style={{ marginTop: 12 }}>
            {error}
          </div>
        )}

        <button
          className="button button--primary button--full"
          style={{ marginTop: 20 }}
          disabled={!report.trim() || loading}
          onClick={handleSubmit}
        >
          {loading ? 'Sending report…' : 'Send Report Anonymously'}
        </button>
      </section>
    </div>
  );
}
