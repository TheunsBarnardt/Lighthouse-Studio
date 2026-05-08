'use client';

import { useEffect, useState } from 'react';

interface AuditEvent {
  id: string;
  eventType: string;
  actorId: string;
  actorEmail: string | null;
  targetId: string | null;
  workspaceId: string | null;
  createdAt: string;
  metadata: Record<string, unknown>;
}

export default function AdminAuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ eventType: search });
    void (async () => {
      try {
        const r = await fetch(`/api/v1/admin/audit?${params.toString()}`, {
          credentials: 'include',
        });
        const d = (await r.json()) as { items: AuditEvent[] };
        setEvents(d.items);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, [search]);

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--fg-primary)' }}>
          Audit log
        </h1>
      </div>

      <div className="pg-card">
        <div className="pg-card-header" style={{ paddingBottom: '0.75rem' }}>
          <input
            type="search"
            placeholder="Filter by event type…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
            }}
            aria-label="Filter audit log"
            style={{
              width: '100%',
              padding: '0.4375rem 0.75rem',
              border: '1px solid var(--border-default)',
              borderRadius: '6px',
              background: 'var(--bg-canvas)',
              color: 'var(--fg-primary)',
              fontSize: '0.875rem',
              outline: 'none',
            }}
          />
        </div>
        <div style={{ padding: '0 1.25rem 1.25rem' }}>
          {loading && (
            <p
              style={{
                padding: '2rem 0',
                textAlign: 'center',
                fontSize: '0.875rem',
                color: 'var(--fg-secondary)',
              }}
              aria-live="polite"
            >
              Loading…
            </p>
          )}
          {!loading && events.length === 0 && (
            <p
              style={{
                padding: '2rem 0',
                textAlign: 'center',
                fontSize: '0.875rem',
                color: 'var(--fg-secondary)',
              }}
            >
              No audit events found.
            </p>
          )}
          {!loading && events.length > 0 && (
            <div className="pg-table-wrap">
              <table className="pg-data-table" role="grid" aria-label="Audit log">
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Actor</th>
                    <th>Workspace</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((ev) => (
                    <tr key={ev.id}>
                      <td>
                        <span
                          className="pg-badge pg-badge-default pg-mono"
                          style={{ fontSize: '0.75rem' }}
                        >
                          {ev.eventType}
                        </span>
                      </td>
                      <td style={{ color: 'var(--fg-secondary)' }}>
                        {ev.actorEmail ?? ev.actorId}
                      </td>
                      <td style={{ color: 'var(--fg-secondary)' }}>{ev.workspaceId ?? '—'}</td>
                      <td style={{ color: 'var(--fg-secondary)' }}>
                        {new Date(ev.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
