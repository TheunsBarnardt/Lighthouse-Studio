'use client';

import { Bug, Zap, Package, MessageSquare, Plus } from 'lucide-react';
import { useState } from 'react';

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
  error: <Bug style={{ width: 16, height: 16, color: 'var(--fg-danger)' }} />,
  perf: <Zap style={{ width: 16, height: 16, color: 'var(--fg-warning)' }} />,
  user_report: <MessageSquare style={{ width: 16, height: 16, color: 'var(--accent-primary)' }} />,
  dependency_advisory: <Package style={{ width: 16, height: 16, color: 'var(--fg-secondary)' }} />,
  feature_request: <Plus style={{ width: 16, height: 16, color: 'var(--fg-success)' }} />,
};

const SEVERITY_BADGE: Record<Severity, string> = {
  critical: 'pg-badge-danger',
  high: 'pg-badge-danger',
  medium: 'pg-badge-warning',
  low: 'pg-badge-default',
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
        <h2 style={{ fontWeight: 600, fontSize: 14, color: 'var(--fg-primary)' }}>
          Signals ({DEMO_SIGNALS.length})
        </h2>
        <button
          className="pg-btn pg-btn-primary pg-btn-sm"
          disabled={selectedSignals.size === 0}
          onClick={() => {
            setShowCreateRequest(true);
          }}
        >
          Create Change Request ({selectedSignals.size})
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {DEMO_SIGNALS.map((signal) => (
          <div
            key={signal.id}
            style={{
              border: selectedSignals.has(signal.id)
                ? '1px solid var(--accent-primary)'
                : '1px solid var(--border-default)',
              borderRadius: 6,
              padding: 16,
              cursor: 'pointer',
              background: selectedSignals.has(signal.id)
                ? 'color-mix(in srgb, var(--accent-primary) 5%, transparent)'
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
                  <span className={`pg-badge ${SEVERITY_BADGE[signal.severity]}`}>
                    {signal.severity}
                  </span>
                  {signal.stage && (
                    <span className="pg-badge pg-badge-default">
                      {signal.stage.replace('_', ' ')}
                    </span>
                  )}
                  <span
                    className={`pg-badge ${signal.status === 'new' ? 'pg-badge-danger' : 'pg-badge-default'}`}
                  >
                    {signal.status.replace('_', ' ')}
                  </span>
                </div>
                <p
                  className="pg-mono"
                  style={{
                    fontSize: 12,
                    color: 'var(--fg-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {signal.message}
                </p>
                <p style={{ fontSize: 11, color: 'var(--fg-tertiary)', marginTop: 4 }}>
                  {signal.occurrences} occurrence{signal.occurrences !== 1 ? 's' : ''} · first seen{' '}
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
