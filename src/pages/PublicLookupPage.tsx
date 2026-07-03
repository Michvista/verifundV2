import { useState } from 'react';
import { StatusPill } from '../components/StatusPill';

type LookupResult = {
  id: string;
  name: string;
  state: string;
  registrationNumber: string;
  memberCount: number;
  healthScore: number;
  isActive: boolean;
};

const baseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'http://localhost:5050/api';

export function PublicLookupPage() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleLookup() {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`${baseUrl}/cooperatives/${encodeURIComponent(query.trim())}`);
      if (!res.ok) throw new Error(`Cooperative not found (${res.status})`);
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const score = result?.healthScore ?? 0;
  const scoreTone = score >= 80 ? 'success' : score >= 60 ? 'warn' : 'danger';

  return (
    <div className="lookup-page">
      <section className="lookup-card page-reveal">
        <div className="eyebrow">Public Trust Registry</div>
        <h2>Search Cooperative ID</h2>
        <p style={{ marginTop: 8, color: 'var(--muted)', fontSize: 14 }}>
          Enter a cooperative registration ID (e.g.{' '}
          <button
            style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 0, fontWeight: 600 }}
            onClick={() => setQuery('okafor-farmers-thrift')}
          >
            okafor-farmers-thrift
          </button>
          ) to view its verified trust profile.
        </p>
        <label className="input-block">
          <span>Cooperative ID or Registration Number</span>
          <input
            placeholder="okafor-farmers-thrift"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
          />
        </label>
        {error && (
          <div className="callout" style={{ marginTop: 12 }}>{error}</div>
        )}
        <button
          className="button button--primary button--full"
          style={{ marginTop: 16 }}
          disabled={!query.trim() || loading}
          onClick={handleLookup}
        >
          {loading ? 'Looking up…' : 'Lookup'}
        </button>
      </section>

      {result && (
        <section className="lookup-result page-reveal">
          <div className="lookup-result__header">
            <div>
              <div className="eyebrow">Entity Identity</div>
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
              <strong>{result.memberCount != null ? result.memberCount.toLocaleString() + ' Verified' : 'N/A'}</strong>
            </div>
            <div className="success-block__row">
              <span>Health Score</span>
              <strong>
                <StatusPill tone={scoreTone}>{`${score}/100`}</StatusPill>
              </strong>
            </div>
          </div>
          <p className="lookup-result__body">
            This cooperative maintains an active audit trail and all contribution records are
            cryptographically anchored to the VeriFund ledger.
          </p>
        </section>
      )}
    </div>
  );
}
