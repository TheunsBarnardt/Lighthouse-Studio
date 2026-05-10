'use client';

import { ArrowRight } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

import { EngageStageDialog } from '../dialogs/EngageStageDialog';
import { ResolveChangeRequestDialog } from '../dialogs/ResolveChangeRequestDialog';

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
  p0: 'inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive',
  p1: 'inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  p2: 'inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  p3: 'inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground',
};

const DEMO_REQUESTS: ChangeRequest[] = [
  {
    id: 'cr-1',
    description:
      'ContactsList component throws null error when contact has no assigned owner â€” missing null check in the generated component',
    status: 'open',
    priority: 'p1',
    severity: 'high',
    suggestedStages: ['ui_generation'],
    signalCount: 47,
    createdAt: '2h ago',
  },
  {
    id: 'cr-2',
    description:
      'Export CSV feature missing notes column in output â€” appears to be a scope gap in the original generation',
    status: 'open',
    priority: 'p3',
    severity: 'low',
    suggestedStages: ['code_generation'],
    signalCount: 1,
    createdAt: '1h ago',
  },
];

export function ChangeRequestsPanel() {
  const [engageTarget, setEngageTarget] = useState<string | null>(null);
  const [resolveTarget, setResolveTarget] = useState<string | null>(null);

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2 style={{ fontWeight: 600, fontSize: 14 }}>Change Requests ({DEMO_REQUESTS.length})</h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {DEMO_REQUESTS.map((cr) => (
          <div
            key={cr.id}
            style={{
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 6,
                    flexWrap: 'wrap',
                  }}
                >
                  <span
                    className={`inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground ${PRIORITY_BADGE[cr.priority]}`}
                  >
                    {cr.priority}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    {cr.status.replace('_', ' ')}
                  </span>
                  <span style={{ fontSize: 11 }}>
                    {cr.signalCount} signal{cr.signalCount !== 1 ? 's' : ''} Â· {cr.createdAt}
                  </span>
                </div>
                <p style={{ fontSize: 13 }}>{cr.description}</p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11 }}>Suggested stages:</span>
              {cr.suggestedStages.map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                >
                  {s.replace('_', ' ')}
                </span>
              ))}
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => {
                    setResolveTarget(cr.id);
                  }}
                >
                  Resolve
                </Button>
                <Button
                  size="sm"
                  type="button"
                  onClick={() => {
                    setEngageTarget(cr.id);
                  }}
                >
                  Engage Stage <ArrowRight style={{ width: 12, height: 12, marginLeft: 4 }} />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {engageTarget && (
        <EngageStageDialog
          requestId={engageTarget}
          onClose={() => {
            setEngageTarget(null);
          }}
        />
      )}
      {resolveTarget && (
        <ResolveChangeRequestDialog
          requestId={resolveTarget}
          onClose={() => {
            setResolveTarget(null);
          }}
        />
      )}
    </div>
  );
}
