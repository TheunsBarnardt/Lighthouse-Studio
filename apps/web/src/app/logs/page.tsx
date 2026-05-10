'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';

// ---------------------------------------------------------------------------
// Static data
// ---------------------------------------------------------------------------

const STREAMS = [
  'API',
  'Auth',
  'Database',
  'Storage',
  'Functions',
  'Realtime',
  'Audit Log',
] as const;
type Stream = (typeof STREAMS)[number];

const ACTORS = ['joana', 'marcus', 'priya', 'tom', 'system'];
const CODES = ['200', '201', '200', '200', '404', '200', '200', '500', '200', '200'];

const ALL_LOG_ENTRIES = Array.from({ length: 20 }, (_, i) => ({
  time: `14:32:${String(15 - i).padStart(2, '0')}`,
  actor: ACTORS[i % ACTORS.length],
  path: `GET /rest/v1/contacts${i % 3 === 0 ? ` Â· /by/id/${String(1000 + i)}` : ''}`,
  status: CODES[i % CODES.length],
  latency: `${String(i * 3 + 12)}ms`,
}));

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusBadge({ code }: { code: string }) {
  if (code.startsWith('2'))
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 font-mono text-sm">
        {code}
      </span>
    );
  if (code.startsWith('5'))
    return (
      <span className="inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive font-mono text-sm">
        {code}
      </span>
    );
  return (
    <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-mono text-sm">
      {code}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function LogsPage() {
  const [activeStream, setActiveStream] = useState<Stream>('API');
  const [filter, setFilter] = useState('');

  const entries = ALL_LOG_ENTRIES.filter(
    (e) =>
      !filter ||
      e.actor.toLowerCase().includes(filter.toLowerCase()) ||
      e.path.toLowerCase().includes(filter.toLowerCase()) ||
      e.status.includes(filter),
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Page header */}
      <div className="mb-5 flex items-start justify-between gap-4" style={{ padding: '16px 24px' }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>{activeStream} Logs</h1>
          <div style={{ fontSize: 13, marginTop: 4 }}>
            Live tail Â· 7-day retention Â· 2,347 entries today
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <input
            style={{
              width: 240,
              height: 28,
              padding: '0 8px',
              fontSize: 13,
              border: '1px solid var(--border)',
              borderRadius: 4,
            }}
            placeholder="Filter logs..."
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
            }}
          />
          <Button variant="outline" size="sm" type="button">
            Export
          </Button>
        </div>
      </div>

      {/* Stream tabs */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          padding: '0 16px',
        }}
      >
        {STREAMS.map((stream) => (
          <Button
            key={stream}
            onClick={() => {
              setActiveStream(stream);
            }}
            style={{
              position: 'relative',
              padding: '8px 12px',
              fontSize: 12,
              fontWeight: 500,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: activeStream === stream ? 'var(--primary)' : 'var(--muted-foreground)',
              borderBottom:
                activeStream === stream
                  ? '2px solid var(--primary)'
                  : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            {stream}
          </Button>
        ))}
      </div>

      {/* Log table */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <div className="overflow-hidden rounded-md border">
          <table
            className="w-full border-collapse text-sm"
            style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}
          >
            <thead>
              <tr>
                <th>When</th>
                <th>Actor</th>
                <th>Path</th>
                <th>Status</th>
                <th className="tabular-nums" style={{ textAlign: 'right' }}>
                  Latency
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, i) => (
                <tr key={i} style={{ cursor: 'pointer' }}>
                  <td className="tabular-nums">{entry.time}</td>
                  <td>{entry.actor}</td>
                  <td>{entry.path}</td>
                  <td>
                    <StatusBadge code={entry.status} />
                  </td>
                  <td className="tabular-nums" style={{ textAlign: 'right' }}>
                    {entry.latency}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
