import { useEffect, useState } from 'react';
import { NombaOperationsPanel } from '../components/NombaOperationsPanel';
import { SectionCard } from '../components/SectionCard';
import { StatusPill } from '../components/StatusPill';
import { ACTIVE_COOPERATIVE_EVENT } from '../components/Shell';
import type { NombaCronStatus } from '../services/api';
import { readStorage } from '../services/browserStorage';

function loadCooperativeId() {
  return readStorage('verifund_cooperative_id') || '';
}

export function TransactionsPage() {
  const [cooperativeId, setCooperativeId] = useState(loadCooperativeId);
  const [status, setStatus] = useState<NombaCronStatus | null>(null);

  useEffect(() => {
    function syncActiveCooperative() {
      setCooperativeId(loadCooperativeId());
    }

    window.addEventListener(ACTIVE_COOPERATIVE_EVENT, syncActiveCooperative);
    window.addEventListener('storage', syncActiveCooperative);

    return () => {
      window.removeEventListener(ACTIVE_COOPERATIVE_EVENT, syncActiveCooperative);
      window.removeEventListener('storage', syncActiveCooperative);
    };
  }, []);

  if (!cooperativeId) {
    return (
      <SectionCard
        title="Transactions"
        className="page-reveal"
      >
        <p className="empty-state">No cooperative selected.</p>
      </SectionCard>
    );
  }

  return (
    <div className="withdrawal-layout">
      <SectionCard
        title="Transaction Operations"
        actions={<StatusPill tone={status?.nombaConfigured ? 'success' : 'soft'}>{status?.nombaConfigured ? 'LIVE' : 'DEMO MODE'}</StatusPill>}
        className="page-reveal"
      >
        <div className="detail-grid">
          <div>
            <span>Active Cooperative</span>
            <strong>{cooperativeId}</strong>
          </div>
          <div>
            <span>Pending Credits</span>
            <strong>{status?.pendingCredits ?? 0}</strong>
          </div>
          <div>
            <span>Poll Interval</span>
            <strong>{status ? `${Math.round(status.pollIntervalMs / 1000)}s` : 'Unknown'}</strong>
          </div>
        </div>
      </SectionCard>

      <NombaOperationsPanel cooperativeId={cooperativeId} onStatusChange={setStatus} />
    </div>
  );
}
