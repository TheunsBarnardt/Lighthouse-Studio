'use client';

import { CheckCircle2, XCircle, RotateCcw, Clock } from 'lucide-react';

type Status = 'deployed' | 'failed' | 'rolled_back' | 'cancelled';

interface HistoryEntry {
  id: string;
  environment: string;
  version: string;
  status: Status;
  startedAt: string;
  durationMin: number;
  startedBy: string;
}

const STATUS_ICON: Record<Status, React.ReactNode> = {
  deployed: <CheckCircle2 style={{ width: 16, height: 16, color: 'var(--fg-success)' }} />,
  failed: <XCircle style={{ width: 16, height: 16, color: 'var(--fg-danger)' }} />,
  rolled_back: <RotateCcw style={{ width: 16, height: 16, color: 'var(--fg-warning)' }} />,
  cancelled: <Clock style={{ width: 16, height: 16, color: 'var(--fg-tertiary)' }} />,
};

const STATUS_BADGE: Record<Status, string> = {
  deployed: 'pg-badge-success',
  failed: 'pg-badge-danger',
  rolled_back: 'pg-badge-warning',
  cancelled: 'pg-badge-default',
};

const DEMO_HISTORY: HistoryEntry[] = [
  {
    id: 'dep-001',
    environment: 'dev',
    version: 'v0.0.1',
    status: 'deployed',
    startedAt: '2026-05-07 14:32',
    durationMin: 2,
    startedBy: 'alice@example.com',
  },
];

export function HistoryPanel() {
  if (DEMO_HISTORY.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: 'var(--fg-tertiary)',
          fontSize: 13,
        }}
      >
        No deployments yet.
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ fontWeight: 600, fontSize: 14, color: 'var(--fg-primary)', marginBottom: 16 }}>
        Deployment History
      </h2>
      <div className="pg-table-wrap">
        <table className="pg-data-table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Environment</th>
              <th>Version</th>
              <th>Started</th>
              <th>Duration</th>
              <th>By</th>
            </tr>
          </thead>
          <tbody>
            {DEMO_HISTORY.map((entry) => (
              <tr key={entry.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {STATUS_ICON[entry.status]}
                    <span className={`pg-badge ${STATUS_BADGE[entry.status]}`}>
                      {entry.status.replace('_', ' ')}
                    </span>
                  </div>
                </td>
                <td style={{ textTransform: 'capitalize' }}>{entry.environment}</td>
                <td>
                  <span className="pg-mono" style={{ fontSize: 11 }}>
                    {entry.version}
                  </span>
                </td>
                <td style={{ color: 'var(--fg-tertiary)' }}>{entry.startedAt}</td>
                <td style={{ color: 'var(--fg-tertiary)' }}>{entry.durationMin}m</td>
                <td style={{ color: 'var(--fg-tertiary)' }}>{entry.startedBy}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
