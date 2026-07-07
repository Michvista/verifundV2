import { useEffect, useState } from 'react';
import { Modal } from '../components/Modal';
import { StatusPill } from '../components/StatusPill';
import { getAlerts, getAlert, type AlertItem } from '../services/api';

export function FraudAlertsPage() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<AlertItem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  async function loadAlerts() {
    setLoading(true);
    setError(null);
    try {
      const result = await getAlerts();
      setAlerts(result.alerts);
    } catch (err) {
      setAlerts([]);
      setError(err instanceof Error ? err.message : 'Fraud alerts could not be loaded.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAlerts();
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setSelectedAlert(null);
      setDetailError(null);
      return;
    }

    const cached = alerts.find((alert) => alert.id === selectedId);
    if (cached) {
      setSelectedAlert(cached);
      return;
    }

    setDetailLoading(true);
    setDetailError(null);
    void getAlert(selectedId)
      .then(setSelectedAlert)
      .catch((err) => {
        setSelectedAlert(null);
        setDetailError(err instanceof Error ? err.message : 'Fraud alert detail could not be loaded.');
      })
      .finally(() => setDetailLoading(false));
  }, [alerts, selectedId]);

  return (
    <div className="alerts-page">
      {error ? (
        <section className="alert-card page-reveal">
          <div className="callout">
            {error}
            <button className="button button--ghost" style={{ marginTop: 12 }} onClick={() => void loadAlerts()}>
              Retry Alerts
            </button>
          </div>
        </section>
      ) : alerts.length ? (
        alerts.map((alert) => (
          <section
            className="alert-card page-reveal alert-card--interactive"
            key={alert.id}
            onClick={() => setSelectedId(alert.id)}
          >
            <h2>{alert.title}</h2>
            <p>{alert.reason}</p>
            <div className="alert-card__footer">
              <StatusPill tone={alert.severity === 'High' ? 'danger' : 'warn'}>
                {alert.severity.toUpperCase()}
              </StatusPill>
              <div className="alert-actions">
                <button
                  className="button button--ghost"
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedId(alert.id);
                  }}
                >
                  View Detail
                </button>
              </div>
            </div>
          </section>
        ))
      ) : (
        <section className="alert-card page-reveal">
          <p className="empty-state">
            {loading ? 'Loading...' : 'No fraud alerts yet.'}
          </p>
        </section>
      )}

      <Modal
        open={Boolean(selectedId)}
        title={selectedAlert?.title || 'Fraud Alert'}
        onClose={() => setSelectedId(null)}
        footer={
          <div className="alert-actions">
            <button className="button button--ghost" disabled>False Positive</button>
            <button className="button button--ghost" disabled>Escalate</button>
            <button className="button button--primary" disabled>Block</button>
          </div>
        }
      >
        {detailLoading ? (
          <p className="empty-state">Loading...</p>
        ) : detailError ? (
          <div className="callout">{detailError}</div>
        ) : selectedAlert ? (
          <div className="modal-stack">
            <p>{selectedAlert.reason}</p>
            <div className="detail-grid">
              <div>
                <span>Risk Score</span>
                <strong>{Math.round(selectedAlert.riskScore * 100)}/100</strong>
              </div>
              <div>
                <span>Severity</span>
                <strong>{selectedAlert.severity}</strong>
              </div>
              <div>
                <span>Detection Rule</span>
                <strong>{String(selectedAlert.evidence?.rule || selectedAlert.triggeredBy || 'rule-engine')}</strong>
              </div>
              <div>
                <span>Evidence</span>
                <strong>{Object.keys(selectedAlert.evidence ?? {}).length} signals</strong>
              </div>
            </div>
            <pre className="evidence-block">
              {JSON.stringify(selectedAlert.evidence ?? {}, null, 2)}
            </pre>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
