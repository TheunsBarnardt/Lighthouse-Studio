'use client';

import { ArrowRight } from 'lucide-react';
import { useState } from 'react';

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
  p0: 'pg-badge-danger',
  p1: 'pg-badge-warning',
  p2: 'pg-badge-warning',
  p3: 'pg-badge-default',
};

const DEMO_REQUESTS: ChangeRequest[] = [
  {
    id: 'cr-1',
    description:
      'ContactsList component throws null error when contact has no assigned owner — missing null check in the generated component',
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
      'Export CSV feature missing notes column in output — appears to be a scope gap in the original generation',
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
      <h2 style={{ fontWeight: 600, fontSize: 14, color: 'var(--fg-primary)' }}>
        Change Requests ({DEMO_REQUESTS.length})
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {DEMO_REQUESTS.map((cr) => (
          <div
            key={cr.id}
            style={{
              border: '1px solid var(--border-default)',
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
                  <span className={`pg-badge ${PRIORITY_BADGE[cr.priority]}`}>{cr.priority}</span>
                  <span className="pg-badge pg-badge-default">{cr.status.replace('_', ' ')}</span>
                  <span style={{ fontSize: 11, color: 'var(--fg-tertiary)' }}>
                    {cr.signalCount} signal{cr.signalCount !== 1 ? 's' : ''} · {cr.createdAt}
                  </span>
                </div>
                <p style={{ fontSize: 13, color: 'var(--fg-primary)' }}>{cr.description}</p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: 'var(--fg-tertiary)' }}>Suggested stages:</span>
              {cr.suggestedStages.map((s) => (
                <span key={s} className="pg-badge pg-badge-default">
                  {s.replace('_', ' ')}
                </span>
              ))}
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  className="pg-btn pg-btn-secondary pg-btn-sm"
                  onClick={() => {
                    setResolveTarget(cr.id);
                  }}
                >
                  Resolve
                </button>
                <button
                  className="pg-btn pg-btn-primary pg-btn-sm"
                  onClick={() => {
                    setEngageTarget(cr.id);
                  }}
                >
                  Engage Stage <ArrowRight style={{ width: 12, height: 12, marginLeft: 4 }} />
                </button>
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
