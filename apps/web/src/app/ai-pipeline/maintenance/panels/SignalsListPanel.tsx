'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Bug, Zap, Package, MessageSquare, Plus } from 'lucide-react';
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
  error: <Bug className="h-4 w-4 text-red-500" />,
  perf: <Zap className="h-4 w-4 text-amber-500" />,
  user_report: <MessageSquare className="h-4 w-4 text-blue-500" />,
  dependency_advisory: <Package className="h-4 w-4 text-purple-500" />,
  feature_request: <Plus className="h-4 w-4 text-green-500" />,
};

const SEVERITY_BADGE: Record<Severity, string> = {
  critical: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  medium: 'bg-amber-100 text-amber-800',
  low: 'bg-gray-100 text-gray-700',
};

const DEMO_SIGNALS: Signal[] = [
  { id: 'sig-1', source: 'error', severity: 'high', status: 'classified', message: "TypeError: Cannot read properties of null (reading 'name') at ContactsList.tsx:42", stage: 'ui_generation', occurrences: 47, firstSeen: '2h ago' },
  { id: 'sig-2', source: 'perf', severity: 'medium', status: 'new', message: 'GET /api/contacts p99 latency increased from 120ms to 890ms', stage: undefined, occurrences: 1, firstSeen: '30m ago' },
  { id: 'sig-3', source: 'user_report', severity: 'low', status: 'new', message: "Export to CSV doesn't include the notes column", stage: undefined, occurrences: 1, firstSeen: '1h ago' },
];

export function SignalsListPanel() {
  const [selectedSignals, setSelectedSignals] = useState<Set<string>>(new Set());
  const [showCreateRequest, setShowCreateRequest] = useState(false);

  const toggle = (id: string) => {
    setSelectedSignals(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Signals ({DEMO_SIGNALS.length})</h2>
        <Button
          size="sm"
          disabled={selectedSignals.size === 0}
          onClick={() => setShowCreateRequest(true)}
        >
          Create Change Request ({selectedSignals.size})
        </Button>
      </div>

      <div className="space-y-2">
        {DEMO_SIGNALS.map(signal => (
          <div
            key={signal.id}
            className={`border rounded-lg p-4 cursor-pointer transition-colors ${selectedSignals.has(signal.id) ? 'border-primary bg-primary/5' : 'hover:bg-muted/30'}`}
            onClick={() => toggle(signal.id)}
          >
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={selectedSignals.has(signal.id)}
                readOnly
                className="mt-1"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  {SOURCE_ICON[signal.source]}
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${SEVERITY_BADGE[signal.severity]}`}>
                    {signal.severity}
                  </span>
                  {signal.stage && (
                    <Badge variant="outline" className="text-xs">{signal.stage.replace('_', ' ')}</Badge>
                  )}
                  <Badge variant={signal.status === 'new' ? 'destructive' : 'secondary'} className="text-xs">
                    {signal.status.replace('_', ' ')}
                  </Badge>
                </div>
                <p className="text-sm font-mono truncate">{signal.message}</p>
                <p className="text-xs text-muted-foreground mt-1">{signal.occurrences} occurrence{signal.occurrences !== 1 ? 's' : ''} · first seen {signal.firstSeen}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showCreateRequest && (
        <CreateChangeRequestDialog
          signalIds={Array.from(selectedSignals)}
          onClose={() => setShowCreateRequest(false)}
        />
      )}
    </div>
  );
}
