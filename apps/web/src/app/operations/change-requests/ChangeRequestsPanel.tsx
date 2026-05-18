'use client';

import { ArrowRight, Inbox } from 'lucide-react';
import { useState } from 'react';

import { EngageStageDialog } from '@/components/change-requests/EngageStageDialog';
import { ResolveChangeRequestDialog } from '@/components/change-requests/ResolveChangeRequestDialog';
import { Button } from '@/components/ui/button';

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

const changeRequests: ChangeRequest[] = [];

export function ChangeRequestsPanel() {
  const [engageTarget, setEngageTarget] = useState<string | null>(null);
  const [resolveTarget, setResolveTarget] = useState<string | null>(null);

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2 style={{ fontWeight: 600, fontSize: 14, margin: 0 }}>
        Change Requests ({changeRequests.length})
      </h2>

      {changeRequests.length === 0 ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: 192,
            gap: 8,
            color: 'var(--muted-foreground)',
          }}
        >
          <Inbox style={{ width: 32, height: 32 }} />
          <p style={{ fontSize: 13, margin: 0 }}>
            No change requests. Signals from deployed builds will appear here.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {changeRequests.map((cr) => (
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
                    <span className={PRIORITY_BADGE[cr.priority]}>{cr.priority}</span>
                    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      {cr.status.replace('_', ' ')}
                    </span>
                    <span style={{ fontSize: 11 }}>
                      {cr.signalCount} signal{cr.signalCount !== 1 ? 's' : ''} · {cr.createdAt}
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
      )}

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
