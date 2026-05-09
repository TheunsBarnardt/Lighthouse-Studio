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
  deployed: <CheckCircle2 style={{ width: 16, height: 16 }} />,
  failed: <XCircle style={{ width: 16, height: 16 }} />,
  rolled_back: <RotateCcw style={{ width: 16, height: 16 }} />,
  cancelled: <Clock style={{ width: 16, height: 16 }} />,
};

const STATUS_BADGE: Record<Status, string> = {
  deployed:
    'inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  failed:
    'inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive',
  rolled_back:
    'inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  cancelled:
    'inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground',
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
          fontSize: 13,
        }}
      >
        No deployments yet.
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ fontWeight: 600, fontSize: 14, marginBottom: 16 }}>Deployment History</h2>
      <div className="overflow-hidden rounded-md border">
        <table className="w-full border-collapse text-sm">
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
                    <span
                      className={`inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground ${STATUS_BADGE[entry.status]}`}
                    >
                      {entry.status.replace('_', ' ')}
                    </span>
                  </div>
                </td>
                <td style={{ textTransform: 'capitalize' }}>{entry.environment}</td>
                <td>
                  <span className="font-mono text-sm" style={{ fontSize: 11 }}>
                    {entry.version}
                  </span>
                </td>
                <td>{entry.startedAt}</td>
                <td>{entry.durationMin}m</td>
                <td>{entry.startedBy}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
