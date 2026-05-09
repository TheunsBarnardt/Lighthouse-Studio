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
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Audit log</h1>
      </div>

      <div className="rounded-md border bg-card text-card-foreground p-4">
        <div
          className="mb-3 flex items-center justify-between border-b pb-3"
          style={{ paddingBottom: '0.75rem' }}
        >
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
              }}
            >
              No audit events found.
            </p>
          )}
          {!loading && events.length > 0 && (
            <div className="overflow-hidden rounded-md border">
              <table className="w-full border-collapse text-sm" role="grid" aria-label="Audit log">
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
                          className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground font-mono text-sm"
                          style={{ fontSize: '0.75rem' }}
                        >
                          {ev.eventType}
                        </span>
                      </td>
                      <td>{ev.actorEmail ?? ev.actorId}</td>
                      <td>{ev.workspaceId ?? '—'}</td>
                      <td>{new Date(ev.createdAt).toLocaleString()}</td>
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
