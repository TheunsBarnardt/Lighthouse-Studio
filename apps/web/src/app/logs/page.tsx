'use client';

import { useState } from 'react';

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
  path: `GET /rest/v1/contacts${i % 3 === 0 ? ` · /by/id/${String(1000 + i)}` : ''}`,
  status: CODES[i % CODES.length],
  latency: `${String(i * 3 + 12)}ms`,
}));

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusBadge({ code }: { code: string }) {
  if (code.startsWith('2'))
    return <span className="pg-badge pg-badge-success pg-mono">{code}</span>;
  if (code.startsWith('5')) return <span className="pg-badge pg-badge-danger pg-mono">{code}</span>;
  return <span className="pg-badge pg-badge-warning pg-mono">{code}</span>;
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
      <div
        className="pg-page-header"
        style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-default)' }}
      >
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--fg-primary)', margin: 0 }}>
            {activeStream} Logs
          </h1>
          <div style={{ fontSize: 13, color: 'var(--fg-secondary)', marginTop: 4 }}>
            Live tail · 7-day retention · 2,347 entries today
          </div>
        </div>
        <div className="pg-page-header-actions">
          <input
            style={{
              width: 240,
              height: 28,
              padding: '0 8px',
              fontSize: 13,
              border: '1px solid var(--border-default)',
              borderRadius: 4,
              background: 'var(--bg-canvas)',
              color: 'var(--fg-primary)',
            }}
            placeholder="Filter logs..."
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
            }}
          />
          <button className="pg-btn pg-btn-secondary pg-btn-sm">Export</button>
        </div>
      </div>

      {/* Stream tabs */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          borderBottom: '1px solid var(--border-default)',
          padding: '0 16px',
          background: 'var(--bg-canvas)',
        }}
      >
        {STREAMS.map((stream) => (
          <button
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
              color: activeStream === stream ? 'var(--accent-primary)' : 'var(--fg-secondary)',
              borderBottom:
                activeStream === stream
                  ? '2px solid var(--accent-primary)'
                  : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            {stream}
          </button>
        ))}
      </div>

      {/* Log table */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <div className="pg-table-wrap">
          <table
            className="pg-data-table"
            style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}
          >
            <thead>
              <tr>
                <th>When</th>
                <th>Actor</th>
                <th>Path</th>
                <th>Status</th>
                <th className="pg-tabular" style={{ textAlign: 'right' }}>
                  Latency
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, i) => (
                <tr key={i} style={{ cursor: 'pointer' }}>
                  <td className="pg-tabular" style={{ color: 'var(--fg-tertiary)' }}>
                    {entry.time}
                  </td>
                  <td style={{ color: 'var(--fg-primary)' }}>{entry.actor}</td>
                  <td style={{ color: 'var(--fg-primary)' }}>{entry.path}</td>
                  <td>
                    <StatusBadge code={entry.status} />
                  </td>
                  <td
                    className="pg-tabular"
                    style={{ textAlign: 'right', color: 'var(--fg-secondary)' }}
                  >
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
