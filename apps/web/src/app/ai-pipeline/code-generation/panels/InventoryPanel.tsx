'use client';

interface Fn {
  id: string;
  name: string;
  triggerType: 'http' | 'schedule' | 'event' | 'manual';
  status: 'draft' | 'validated' | 'approved' | 'rejected';
  staticAnalysisPassed: boolean;
  typeCheckPassed: boolean;
}

function TriggerBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    http: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    schedule: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    event: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    manual: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
  };
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${styles[type] ?? styles.manual}`}>
      {type}
    </span>
  );
}

function StatusIcon({ status, staticOk }: { status: string; staticOk: boolean }) {
  if (!staticOk) return <span className="text-destructive text-xs">!</span>;
  if (status === 'approved') return <span className="text-green-500 text-xs">✓</span>;
  return <span className="w-3" />;
}

interface InventoryPanelProps {
  functions: Fn[];
  selectedId?: string;
  onSelect: (fn: Fn) => void;
}

const GROUP_LABELS: Record<string, string> = {
  http: 'HTTP Functions',
  schedule: 'Scheduled Jobs',
  event: 'Event Handlers',
  manual: 'Manual',
};

export function InventoryPanel({ functions, selectedId, onSelect }: InventoryPanelProps) {
  const grouped = ['http', 'schedule', 'event', 'manual'].map(type => ({
    type,
    fns: functions.filter(f => f.triggerType === type),
  })).filter(g => g.fns.length > 0);

  return (
    <div className="py-2">
      <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b border-border mb-1">
        Functions ({functions.length})
      </div>
      {grouped.map(group => (
        <div key={group.type}>
          <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground mt-2">
            {GROUP_LABELS[group.type]}
          </div>
          {group.fns.map(fn => (
            <button
              key={fn.id}
              onClick={() => onSelect(fn)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left rounded ${fn.id === selectedId ? 'bg-primary/10 text-primary font-medium' : 'text-foreground hover:bg-muted/50'}`}
            >
              <span className="flex-1 truncate font-mono">{fn.name}</span>
              <StatusIcon status={fn.status} staticOk={fn.staticAnalysisPassed} />
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
