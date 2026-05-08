'use client';

import { useState } from 'react';

interface WorkspaceSession {
  id: string;
  user: string;
  email: string;
  started: string;
  ip: string;
  device: string;
}

const INITIAL_SESSIONS: WorkspaceSession[] = [
  {
    id: '1',
    user: 'Joana de Klerk',
    email: 'joana@acme.com',
    started: '2026-05-08 08:14',
    ip: '102.165.2.41',
    device: 'Chrome 132 · macOS',
  },
  {
    id: '2',
    user: 'Marcus Acker',
    email: 'marcus@acme.com',
    started: '2026-05-08 09:02',
    ip: '102.165.2.45',
    device: 'Firefox 122 · Linux',
  },
  {
    id: '3',
    user: 'Priya Singh',
    email: 'priya@acme.com',
    started: '2026-05-08 10:34',
    ip: '102.165.2.49',
    device: 'Safari 18 · iOS',
  },
  {
    id: '4',
    user: 'Tom Müller',
    email: 'tom@acme.com',
    started: '2026-05-08 11:12',
    ip: '102.165.2.52',
    device: 'Chrome 132 · Windows',
  },
  {
    id: '5',
    user: 'Sara Chen',
    email: 'sara@acme.com',
    started: '2026-05-08 13:48',
    ip: '102.165.2.58',
    device: 'Edge 122 · Windows',
  },
];

export default function AuthSessionsPage() {
  const [sessions, setSessions] = useState<WorkspaceSession[]>(INITIAL_SESSIONS);
  const [revoking, setRevoking] = useState<string | null>(null);

  function revokeSession(id: string) {
    setRevoking(id);
    setTimeout(() => {
      setSessions((prev) => prev.filter((s) => s.id !== id));
      setRevoking(null);
    }, 400);
  }

  function revokeAll() {
    setRevoking('all');
    setTimeout(() => {
      setSessions([]);
      setRevoking(null);
    }, 600);
  }

  return (
    <div className="pg-page" style={{ maxWidth: 1280 }}>
      {/* Header */}
      <div className="pg-page-header">
        <div>
          <h1>Active Sessions</h1>
          <p className="subtitle">{sessions.length} active · 3 expired in last 24h</p>
        </div>
        {sessions.length > 0 && (
          <div className="pg-page-header-actions">
            <button
              className="pg-btn pg-btn-sm"
              style={{ background: 'var(--fg-danger)', color: '#fff' }}
              disabled={revoking === 'all'}
              onClick={revokeAll}
            >
              {revoking === 'all' ? 'Revoking…' : 'Revoke all'}
            </button>
          </div>
        )}
      </div>

      {sessions.length === 0 ? (
        <div
          style={{
            borderRadius: 'var(--shell-radius-lg)',
            border: '1px solid var(--border-default)',
            padding: '48px 24px',
            textAlign: 'center',
            fontSize: 13,
            color: 'var(--fg-secondary)',
          }}
        >
          No active sessions.
        </div>
      ) : (
        <div className="pg-table-wrap">
          <table className="pg-data-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Started</th>
                <th>IP address</th>
                <th>Device</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => (
                <tr key={session.id}>
                  <td>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg-primary)' }}>
                        {session.user}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--fg-tertiary)' }}>
                        {session.email}
                      </div>
                    </div>
                  </td>
                  <td className="pg-tabular" style={{ fontSize: 12, color: 'var(--fg-secondary)' }}>
                    {session.started}
                  </td>
                  <td className="pg-mono" style={{ fontSize: 12, color: 'var(--fg-secondary)' }}>
                    {session.ip}
                  </td>
                  <td style={{ fontSize: 13, color: 'var(--fg-secondary)' }}>{session.device}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="pg-btn pg-btn-ghost pg-btn-xs"
                      style={{ color: 'var(--fg-danger)' }}
                      disabled={revoking === session.id}
                      onClick={() => {
                        revokeSession(session.id);
                      }}
                    >
                      {revoking === session.id ? 'Revoking…' : 'Revoke'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
