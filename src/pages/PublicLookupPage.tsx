import { useState } from 'react';
import { StatusPill } from '../components/StatusPill';
import { lookupCooperative, type CooperativeResponse } from '../services/api';

export function PublicLookupPage() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CooperativeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastLookup, setLastLookup] = useState<string | null>(null);

  async function handleLookup() {
    const cooperativeId = query.trim();
    if (!cooperativeId) return;

    setLoading(true);
    setError(null);
    setResult(null);
    try {
      setResult(await lookupCooperative(cooperativeId));
      setLastLookup(cooperativeId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cooperative could not be loaded.');
    } finally {
      setLoading(false);
    }
  }

  const score = result?.healthScore ?? 0;
  const scoreTone = score >= 80 ? 'success' : score >= 60 ? 'warn' : 'danger';

  return (
    <div className="lookup-page">
      <section className="lookup-card page-reveal">
        <h2>Search cooperative ID</h2>

        <label className="input-block">
          <span>Cooperative ID</span>
          <input
            placeholder="Enter cooperative ID"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
          />
        </label>

        {error && (
          <div className="callout" style={{ marginTop: 12 }}>
            {error}
          </div>
        )}

        {result && (
          <div className="notice" style={{ marginTop: 12 }}>
            Loaded <strong>{lastLookup}</strong>.
          </div>
        )}

        <button
          className="button button--primary button--full"
          style={{ marginTop: 16 }}
          disabled={!query.trim() || loading}
          onClick={handleLookup}
        >
          {loading ? 'Looking up...' : 'Lookup'}
        </button>
      </section>

      {result ? (
        <section className="lookup-result page-reveal">
          <div className="lookup-result__header">
            <div>
              <h2>{result.name}</h2>
              <p style={{ marginTop: 6, color: 'var(--muted)' }}>{result.state}, Nigeria</p>
            </div>
            <StatusPill tone={result.isActive ? 'success' : 'danger'}>
              {result.isActive ? 'VERIFIED' : 'INACTIVE'}
            </StatusPill>
          </div>

          <div className="lookup-result__score">
            <div className="score-ring score-ring--xl">
              <span>{score}</span>
              <small>{score >= 80 ? 'Excellent' : score >= 60 ? 'Fair' : 'At Risk'}</small>
            </div>
          </div>

          <div className="success-block" style={{ marginTop: 16 }}>
            <div className="success-block__row">
              <span>Registration Number</span>
              <strong>{result.registrationNumber}</strong>
            </div>
            <div className="success-block__row">
              <span>Member Count</span>
              <strong>{result.memberCount.toLocaleString()} Verified</strong>
            </div>
            <div className="success-block__row">
              <span>Health Score</span>
              <strong>
                <StatusPill tone={scoreTone}>{`${score}/100`}</StatusPill>
              </strong>
            </div>
          </div>
        </section>
      ) : (
        <section className="lookup-result page-reveal">
          <p className="empty-state">No cooperative selected yet.</p>
        </section>
      )}
    </div>
  );
}
