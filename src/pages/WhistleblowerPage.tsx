import { useState } from 'react';
import { submitWhistleblowerReport, type WhistleblowerResponse } from '../services/api';

const MIN_REPORT_LENGTH = 20;

export function WhistleblowerPage() {
  const [report, setReport] = useState('');
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submission, setSubmission] = useState<WhistleblowerResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const trimmedReport = report.trim();
  const trimmedDetails = details.trim();
  const canSubmit = trimmedReport.length >= MIN_REPORT_LENGTH;

  async function handleSubmit() {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      const result = await submitWhistleblowerReport({
        report: trimmedReport,
        supportingDetails: trimmedDetails || undefined,
      });
      setSubmission(result);
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
          <h2>Thank you for your report</h2>
          {submission && (
            <div className="success-block" style={{ marginTop: 18 }}>
              <div className="success-block__row">
                <span>Report ID</span>
                <strong style={{ fontFamily: 'monospace' }}>{submission.report.id}</strong>
              </div>
              <div className="success-block__row">
                <span>Alert ID</span>
                <strong style={{ fontFamily: 'monospace' }}>{submission.alert.id}</strong>
              </div>
              <div className="success-block__row">
                <span>Status</span>
                <strong>{submission.report.status}</strong>
              </div>
              <div className="success-block__row">
                <span>Severity</span>
                <strong>{submission.alert.severity}</strong>
              </div>
            </div>
          )}
          <button
            className="button button--ghost button--full"
            style={{ marginTop: 16 }}
            onClick={() => {
              setSubmitted(false);
              setReport('');
              setDetails('');
              setSubmission(null);
            }}
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
        <h2>Submit concerns</h2>

        <label className="input-block">
          <span>What happened?</span>
          <textarea
            rows={5}
            placeholder="Describe the activity, date, and people involved..."
            value={report}
            onChange={(e) => setReport(e.target.value)}
          />
        </label>

        {report && !canSubmit && (
          <div className="notice" style={{ marginTop: 12 }}>
            Add a little more detail. Reports need at least {MIN_REPORT_LENGTH} characters.
          </div>
        )}

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
          disabled={!canSubmit || loading}
          onClick={handleSubmit}
        >
          {loading ? 'Sending...' : 'Send Report'}
        </button>
      </section>
    </div>
  );
}
