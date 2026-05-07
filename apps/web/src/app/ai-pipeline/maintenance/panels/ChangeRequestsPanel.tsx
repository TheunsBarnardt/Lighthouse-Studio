'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Clock, ArrowRight } from 'lucide-react';
import { EngageStageDialog } from '../dialogs/EngageStageDialog';
import { ResolveChangeRequestDialog } from '../dialogs/ResolveChangeRequestDialog';
import { useState } from 'react';

type CRStatus = 'open' | 'in_progress' | 'pending_approval' | 'resolved' | 'wont_fix';
type Priority = 'p0' | 'p1' | 'p2' | 'p3';

interface ChangeRequest {
  id: string;
  description: string;
  status: CRStatus;
  priority: Priority;
  severity: string;
  suggestedStages: string[];
  signalCount: number;
  createdAt: string;
}

const PRIORITY_BADGE: Record<Priority, string> = {
  p0: 'bg-red-100 text-red-800',
  p1: 'bg-orange-100 text-orange-800',
  p2: 'bg-amber-100 text-amber-800',
  p3: 'bg-gray-100 text-gray-700',
};

const DEMO_REQUESTS: ChangeRequest[] = [
  { id: 'cr-1', description: 'ContactsList component throws null error when contact has no assigned owner — missing null check in the generated component', status: 'open', priority: 'p1', severity: 'high', suggestedStages: ['ui_generation'], signalCount: 47, createdAt: '2h ago' },
  { id: 'cr-2', description: 'Export CSV feature missing notes column in output — appears to be a scope gap in the original generation', status: 'open', priority: 'p3', severity: 'low', suggestedStages: ['code_generation'], signalCount: 1, createdAt: '1h ago' },
];

export function ChangeRequestsPanel() {
  const [engageTarget, setEngageTarget] = useState<string | null>(null);
  const [resolveTarget, setResolveTarget] = useState<string | null>(null);

  return (
    <div className="p-6 space-y-4">
      <h2 className="font-semibold">Change Requests ({DEMO_REQUESTS.length})</h2>

      <div className="space-y-3">
        {DEMO_REQUESTS.map(cr => (
          <div key={cr.id} className="border rounded-lg p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${PRIORITY_BADGE[cr.priority]}`}>{cr.priority}</span>
                  <Badge variant="secondary" className="text-xs">{cr.status.replace('_', ' ')}</Badge>
                  <span className="text-xs text-muted-foreground">{cr.signalCount} signal{cr.signalCount !== 1 ? 's' : ''} · {cr.createdAt}</span>
                </div>
                <p className="text-sm">{cr.description}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">Suggested stages:</span>
              {cr.suggestedStages.map(s => (
                <Badge key={s} variant="outline" className="text-xs">{s.replace('_', ' ')}</Badge>
              ))}
              <div className="ml-auto flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setResolveTarget(cr.id)}>
                  Resolve
                </Button>
                <Button size="sm" onClick={() => setEngageTarget(cr.id)}>
                  Engage Stage <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {engageTarget && (
        <EngageStageDialog
          requestId={engageTarget}
          onClose={() => setEngageTarget(null)}
        />
      )}
      {resolveTarget && (
        <ResolveChangeRequestDialog
          requestId={resolveTarget}
          onClose={() => setResolveTarget(null)}
        />
      )}
    </div>
  );
}
