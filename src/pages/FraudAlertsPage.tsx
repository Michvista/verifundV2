import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../components/Modal';
import { StatusPill } from '../components/StatusPill';
import { getAlerts, getAlert, type AlertItem } from '../services/api';

export function FraudAlertsPage() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<AlertItem | null>(null);

  useEffect(() => {
    void getAlerts().then((result) => setAlerts(result.alerts));
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setSelectedAlert(null);
      return;
    }

    const cached = alerts.find((alert) => alert.id === selectedId);
    if (cached) {
      setSelectedAlert(cached);
      return;
    }

    void getAlert(selectedId).then(setSelectedAlert);
  }, [alerts, selectedId]);

  const footer = useMemo(
    () => (
      <div className="alert-actions">
        <button className="button button--ghost">False Positive</button>
        <button className="button button--ghost">Escalate</button>
        <button className="button button--primary">Block</button>
      </div>
    ),
    [],
  );

  return (
    <div className="alerts-page">
      {alerts.map((alert) => (
        <section className="alert-card page-reveal alert-card--interactive" key={alert.id} onClick={() => setSelectedId(alert.id)}>
          <div className="eyebrow">{alert.type.replace('_', ' ')}</div>
          <h2>{alert.title}</h2>
          <p>{alert.reason}</p>
          <div className="alert-card__footer">
            <StatusPill tone={alert.severity === 'High' ? 'danger' : 'warn'}>{alert.severity.toUpperCase()}</StatusPill>
            <div className="alert-actions">
              <button className="button button--ghost" onClick={(event) => { event.stopPropagation(); setSelectedId(alert.id); }}>
                View Detail
              </button>
              <button className="button button--ghost" onClick={(event) => event.stopPropagation()}>
                Escalate
              </button>
              <button className="button button--primary" onClick={(event) => event.stopPropagation()}>
                Block
              </button>
            </div>
          </div>
        </section>
      ))}

      <Modal
        open={Boolean(selectedAlert)}
        title={selectedAlert?.title || 'Fraud Alert'}
        onClose={() => setSelectedId(null)}
        footer={footer}
      >
        {selectedAlert ? (
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
                <strong>{String(selectedAlert.evidence.rule || 'rule-engine')}</strong>
              </div>
              <div>
                <span>Evidence</span>
                <strong>{Object.keys(selectedAlert.evidence).length} signals</strong>
              </div>
            </div>
            <pre className="evidence-block">{JSON.stringify(selectedAlert.evidence, null, 2)}</pre>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
