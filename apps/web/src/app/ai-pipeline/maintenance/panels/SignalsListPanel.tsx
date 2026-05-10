'use client';

import { Bug, Zap, Package, MessageSquare, Plus } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

import { CreateChangeRequestDialog } from '../dialogs/CreateChangeRequestDialog';

type SignalSource = 'error' | 'perf' | 'user_report' | 'dependency_advisory' | 'feature_request';
type Severity = 'critical' | 'high' | 'medium' | 'low';
type Status = 'new' | 'classified' | 'in_change_request' | 'resolved';

interface Signal {
  id: string;
  source: SignalSource;
  severity: Severity;
  status: Status;
  message: string;
  stage?: string;
  occurrences: number;
  firstSeen: string;
}

const SOURCE_ICON: Record<SignalSource, React.ReactNode> = {
  error: <Bug style={{ width: 16, height: 16 }} />,
  perf: <Zap style={{ width: 16, height: 16 }} />,
  user_report: <MessageSquare style={{ width: 16, height: 16 }} />,
  dependency_advisory: <Package style={{ width: 16, height: 16 }} />,
  feature_request: <Plus style={{ width: 16, height: 16 }} />,
};

const SEVERITY_BADGE: Record<Severity, string> = {
  critical:
    'inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive',
  high: 'inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive',
  medium:
    'inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  low: 'inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground',
};

const DEMO_SIGNALS: Signal[] = [
  {
    id: 'sig-1',
    source: 'error',
    severity: 'high',
    status: 'classified',
    message: "TypeError: Cannot read properties of null (reading 'name') at ContactsList.tsx:42",
    stage: 'ui_generation',
    occurrences: 47,
    firstSeen: '2h ago',
  },
  {
    id: 'sig-2',
    source: 'perf',
    severity: 'medium',
    status: 'new',
    message: 'GET /api/contacts p99 latency increased from 120ms to 890ms',
    stage: undefined,
    occurrences: 1,
    firstSeen: '30m ago',
  },
  {
    id: 'sig-3',
    source: 'user_report',
    severity: 'low',
    status: 'new',
    message: "Export to CSV doesn't include the notes column",
    stage: undefined,
    occurrences: 1,
    firstSeen: '1h ago',
  },
];

export function SignalsListPanel() {
  const [selectedSignals, setSelectedSignals] = useState<Set<string>>(new Set());
  const [showCreateRequest, setShowCreateRequest] = useState(false);

  const toggle = (id: string) => {
    setSelectedSignals((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontWeight: 600, fontSize: 14 }}>Signals ({DEMO_SIGNALS.length})</h2>
        <Button
          size="sm"
          type="button"
          disabled={selectedSignals.size === 0}
          onClick={() => {
            setShowCreateRequest(true);
          }}
        >
          Create Change Request ({selectedSignals.size})
        </Button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {DEMO_SIGNALS.map((signal) => (
          <div
            key={signal.id}
            style={{
              border: selectedSignals.has(signal.id)
                ? '1px solid var(--primary)'
                : '1px solid var(--border)',
              borderRadius: 6,
              padding: 16,
              cursor: 'pointer',
              background: selectedSignals.has(signal.id)
                ? 'color-mix(in srgb, var(--primary) 5%, transparent)'
                : 'transparent',
            }}
            onClick={() => {
              toggle(signal.id);
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <input
                type="checkbox"
                checked={selectedSignals.has(signal.id)}
                readOnly
                style={{ marginTop: 4, cursor: 'pointer' }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 4,
                    flexWrap: 'wrap',
                  }}
                >
                  {SOURCE_ICON[signal.source]}
                  <span
                    className={`inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground ${SEVERITY_BADGE[signal.severity]}`}
                  >
                    {signal.severity}
                  </span>
                  {signal.stage && (
                    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      {signal.stage.replace('_', ' ')}
                    </span>
                  )}
                  <span
                    className={`inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground ${signal.status === 'new' ? 'inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive' : 'inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground'}`}
                  >
                    {signal.status.replace('_', ' ')}
                  </span>
                </div>
                <p
                  className="font-mono text-sm"
                  style={{
                    fontSize: 12,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {signal.message}
                </p>
                <p style={{ fontSize: 11, marginTop: 4 }}>
                  {signal.occurrences} occurrence{signal.occurrences !== 1 ? 's' : ''} Â· first seen{' '}
                  {signal.firstSeen}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showCreateRequest && (
        <CreateChangeRequestDialog
          signalIds={Array.from(selectedSignals)}
          onClose={() => {
            setShowCreateRequest(false);
          }}
        />
      )}
    </div>
  );
}
