'use client';

import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

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
        const r = await fetch(`/api/v1/admin/audit?${params.toString()}`, { credentials: 'include' });
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
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Audit log</h1>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <Input
            type="search"
            placeholder="Filter by event type…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); }}
            aria-label="Filter audit log"
          />
        </CardHeader>
        <CardContent>
          {loading && (
            <p className="py-8 text-center text-sm text-muted-foreground" aria-live="polite">Loading…</p>
          )}
          {!loading && events.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">No audit events found.</p>
          )}
          {!loading && events.length > 0 && (
            <table className="w-full text-sm" role="grid" aria-label="Audit log">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Event</th>
                  <th className="pb-2 pr-4 font-medium">Actor</th>
                  <th className="pb-2 pr-4 font-medium">Workspace</th>
                  <th className="pb-2 font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {events.map((ev) => (
                  <tr key={ev.id} className="border-b last:border-0">
                    <td className="py-3 pr-4">
                      <Badge variant="outline" className="font-mono text-xs">{ev.eventType}</Badge>
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">{ev.actorEmail ?? ev.actorId}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{ev.workspaceId ?? '—'}</td>
                    <td className="py-3 text-muted-foreground">
                      {new Date(ev.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
