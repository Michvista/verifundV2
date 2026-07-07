import { useEffect, useState } from 'react';
import { getAuditLog, type AuditEvent } from '../services/api';

type Props = {
  cooperativeId: string;
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown time';

  return new Intl.DateTimeFormat('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function summarizeMetadata(metadata: Record<string, unknown>) {
  const entries = Object.entries(metadata);
  if (!entries.length) return 'No metadata';

  return entries
    .slice(0, 2)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(', ');
}

export function AuditLogPanel({ cooperativeId }: Props) {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadAuditLog() {
    if (!cooperativeId) {
      setEvents([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await getAuditLog(cooperativeId);
      setEvents(response.events);
    } catch (err) {
      setEvents([]);
      setError(err instanceof Error ? err.message : 'Audit log could not be loaded.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAuditLog();
  }, [cooperativeId]);

  if (!cooperativeId) {
    return <p className="empty-state">Create or select a cooperative to load audit events.</p>;
  }

  if (error) {
    return (
      <div className="callout">
        <p>{error}</p>
        <button className="button button--ghost" style={{ marginTop: 12 }} onClick={() => void loadAuditLog()}>
          Retry Audit Log
        </button>
      </div>
    );
  }

  if (!events.length) {
    return (
      <p className="empty-state">
        {loading ? 'Loading audit events...' : 'Audit events will appear after the first live transaction.'}
      </p>
    );
  }

  return (
    <div className="table table--audit">
      <div className="table__head">
        <span>Event</span>
        <span>Description</span>
        <span>Metadata</span>
        <span>Time</span>
      </div>
      {events.map((event) => (
        <div className="table__row" key={event.id}>
          <span>{event.eventType.split('_').join(' ')}</span>
          <span>{event.description}</span>
          <span>{summarizeMetadata(event.metadata)}</span>
          <span>{formatDate(event.createdAt)}</span>
        </div>
      ))}
    </div>
  );
}
