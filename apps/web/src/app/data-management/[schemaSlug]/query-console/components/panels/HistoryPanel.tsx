'use client';

interface HistoryEntry {
  id: string;
  queryText: string;
  queryLanguage: string;
  status: string;
  durationMs: number;
  createdAt: string;
}

interface HistoryPanelProps {
  entries: HistoryEntry[];
  onSelect: (query: string, language: string) => void;
}

function statusColour(status: string) {
  switch (status) {
    case 'succeeded': return 'text-green-600 dark:text-green-400';
    case 'failed': return 'text-red-600 dark:text-red-400';
    case 'timeout': return 'text-yellow-600 dark:text-yellow-400';
    default: return 'text-muted-foreground';
  }
}

export function HistoryPanel({ entries, onSelect }: HistoryPanelProps) {
  if (entries.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No query history yet
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 overflow-y-auto p-2">
      {entries.map((entry) => {
        const preview = entry.queryText.replace(/\s+/g, ' ').trim();
        const display = preview.length > 60 ? `${preview.slice(0, 60)}…` : preview;
        const ts = new Date(entry.createdAt).toLocaleTimeString();

        return (
          <button
            key={entry.id}
            type="button"
            onClick={() => { onSelect(entry.queryText, entry.queryLanguage); }}
            className="flex w-full flex-col items-start gap-0.5 rounded px-2 py-1.5 text-left hover:bg-muted/60"
          >
            <span className="text-xs font-mono leading-tight">{display}</span>
            <div className="flex gap-2 text-xs">
              <span className={statusColour(entry.status)}>{entry.status}</span>
              <span className="text-muted-foreground">{entry.durationMs}ms</span>
              <span className="ml-auto text-muted-foreground">{ts}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
