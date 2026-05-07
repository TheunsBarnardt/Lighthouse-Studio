'use client';

import { Badge } from '@/components/ui/badge';
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
  deployed: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  failed: <XCircle className="h-4 w-4 text-red-500" />,
  rolled_back: <RotateCcw className="h-4 w-4 text-amber-500" />,
  cancelled: <Clock className="h-4 w-4 text-muted-foreground" />,
};

const STATUS_BADGE_VARIANT: Record<Status, 'default' | 'destructive' | 'secondary' | 'outline'> = {
  deployed: 'default',
  failed: 'destructive',
  rolled_back: 'secondary',
  cancelled: 'outline',
};

const DEMO_HISTORY: HistoryEntry[] = [
  { id: 'dep-001', environment: 'dev', version: 'v0.0.1', status: 'deployed', startedAt: '2026-05-07 14:32', durationMin: 2, startedBy: 'alice@example.com' },
];

export function HistoryPanel() {
  if (DEMO_HISTORY.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        No deployments yet.
      </div>
    );
  }

  return (
    <div className="p-6">
      <h2 className="font-semibold mb-4">Deployment History</h2>
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Environment</th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Version</th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Started</th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Duration</th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">By</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {DEMO_HISTORY.map(entry => (
              <tr key={entry.id} className="hover:bg-muted/20">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {STATUS_ICON[entry.status]}
                    <Badge variant={STATUS_BADGE_VARIANT[entry.status]} className="text-xs">
                      {entry.status.replace('_', ' ')}
                    </Badge>
                  </div>
                </td>
                <td className="px-4 py-3 capitalize">{entry.environment}</td>
                <td className="px-4 py-3 font-mono text-xs">{entry.version}</td>
                <td className="px-4 py-3 text-muted-foreground">{entry.startedAt}</td>
                <td className="px-4 py-3 text-muted-foreground">{entry.durationMin}m</td>
                <td className="px-4 py-3 text-muted-foreground">{entry.startedBy}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
