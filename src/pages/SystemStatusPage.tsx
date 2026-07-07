import { useEffect, useState } from 'react';
import { Metric } from '../components/Metric';
import { SectionCard } from '../components/SectionCard';
import { StatusPill } from '../components/StatusPill';
import { getHealth, type HealthResponse } from '../services/api';

function formatDate(value?: string) {
  if (!value) return 'Unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function SystemStatusPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5050/api';
  const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:5050/ws';
  const hasMixedSocketScheme = apiUrl.startsWith('https://') && wsUrl.startsWith('ws://');

  async function loadHealth() {
    setLoading(true);
    setError(null);
    try {
      setHealth(await getHealth());
    } catch (err) {
      setHealth(null);
      setError(err instanceof Error ? err.message : 'Backend health could not be loaded.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadHealth();
  }, []);

  const apiTone = health?.ok ? 'success' : error ? 'danger' : 'neutral';
  const nombaTone = health?.nombaMode === 'live' ? 'success' : 'soft';
  const databaseTone = health?.databaseMode === 'postgres' ? 'success' : 'soft';

  return (
    <div className="withdrawal-layout">
      <SectionCard
        title="System Status"
        actions={<StatusPill tone={apiTone}>{health?.ok ? 'ONLINE' : error ? 'OFFLINE' : 'CHECKING'}</StatusPill>}
        className="page-reveal"
      >
        <div className="detail-grid">
          <div>
            <span>API Base URL</span>
            <strong>{apiUrl}</strong>
          </div>
          <div>
            <span>WebSocket URL</span>
            <strong>{wsUrl}</strong>
          </div>
          <div>
            <span>Service</span>
            <strong>{health?.service ?? (loading ? 'Checking...' : 'Unavailable')}</strong>
          </div>
          <div>
            <span>Backend Mode</span>
            <strong>{health?.mode ?? 'Unknown'}</strong>
          </div>
          <div>
            <span>Database Mode</span>
            <strong>{health?.databaseMode ?? 'Unknown'}</strong>
          </div>
        </div>

        {error && (
          <div className="callout" style={{ marginTop: 16 }}>
            {error}
            <button className="button button--ghost" style={{ marginTop: 12 }} onClick={() => void loadHealth()}>
              Retry Health Check
            </button>
          </div>
        )}
      </SectionCard>

      <section className="risk-panel page-reveal">
        <div className="risk-panel__grid">
          <div>
            <h2>{health?.ok ? 'API is reachable' : loading ? 'Checking backend...' : 'API status unknown'}</h2>
            <p style={{ color: 'var(--muted)', marginTop: 8 }}>
              Last backend timestamp: {formatDate(health?.time)}
            </p>
            <div className="risk-panel__footer">
              <StatusPill tone={nombaTone}>
                {health?.nombaMode ? `NOMBA ${health.nombaMode.toUpperCase()}` : 'NOMBA UNKNOWN'}
              </StatusPill>
              <StatusPill tone={databaseTone}>
                {health?.databaseMode ? `DB ${health.databaseMode.toUpperCase()}` : 'DB UNKNOWN'}
              </StatusPill>
            </div>
          </div>

          <div className="risk-panel__signals">
            <Metric label="HTTP Transport" value={apiUrl.startsWith('https://') ? 'HTTPS' : 'HTTP'} caption="API client" />
            <Metric label="Realtime Transport" value={wsUrl.startsWith('wss://') ? 'WSS' : 'WS'} caption="WebSocket client" />
            <Metric
              label="Socket Safety"
              value={hasMixedSocketScheme ? 'Review' : 'Aligned'}
              caption={hasMixedSocketScheme ? 'Use wss with HTTPS' : 'Scheme compatible'}
            />
          </div>
        </div>

        {hasMixedSocketScheme && (
          <div className="callout" style={{ marginTop: 16 }}>
            Use a secure WebSocket URL for HTTPS frontends.
          </div>
        )}

        {!hasMixedSocketScheme && (
          <div className="notice" style={{ marginTop: 16 }}>
            Transport is compatible.
          </div>
        )}
      </section>
    </div>
  );
}
