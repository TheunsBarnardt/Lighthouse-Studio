'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';

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
    <div className="mx-auto max-w-[1440px] p-6" style={{ maxWidth: 1280 }}>
      {/* Header */}
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1>Active Sessions</h1>
          <p className="subtitle">{sessions.length} active · 3 expired in last 24h</p>
        </div>
        {sessions.length > 0 && (
          <div className="flex shrink-0 items-center gap-2">
            <Button
              className=""
              type="button"
              style={{ background: 'var(--fg-danger)', color: '#fff' }}
              disabled={revoking === 'all'}
              onClick={revokeAll}
            >
              {revoking === 'all' ? 'Revoking…' : 'Revoke all'}
            </Button>
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
          }}
        >
          No active sessions.
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border">
          <table className="w-full border-collapse text-sm">
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
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{session.user}</div>
                      <div style={{ fontSize: 12 }}>{session.email}</div>
                    </div>
                  </td>
                  <td className="tabular-nums" style={{ fontSize: 12 }}>
                    {session.started}
                  </td>
                  <td className="font-mono text-sm" style={{ fontSize: 12 }}>
                    {session.ip}
                  </td>
                  <td style={{ fontSize: 13 }}>{session.device}</td>
                  <td style={{ textAlign: 'right' }}>
                    <Button
                      className=""
                      variant="ghost"
                      type="button"
                      disabled={revoking === session.id}
                      onClick={() => {
                        revokeSession(session.id);
                      }}
                    >
                      {revoking === session.id ? 'Revoking…' : 'Revoke'}
                    </Button>
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
