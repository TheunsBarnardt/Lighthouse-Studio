'use client';

interface SavedQuery {
  id: string;
  name: string;
  description?: string | null;
  queryText: string;
  queryLanguage: string;
  folderPath?: string | null;
  shared: boolean;
}

interface SavedQueriesPanelProps {
  queries: SavedQuery[];
  onSelect: (query: string, language: string) => void;
}

export function SavedQueriesPanel({ queries, onSelect }: SavedQueriesPanelProps) {
  if (queries.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No saved queries yet
      </div>
    );
  }

  // Group by folderPath
  const grouped: Record<string, SavedQuery[]> = {};
  for (const q of queries) {
    const folder = q.folderPath ?? '';
    grouped[folder] = grouped[folder] ?? [];
    grouped[folder].push(q);
  }

  return (
    <div className="flex flex-col gap-1 overflow-y-auto p-2">
      {Object.entries(grouped).map(([folder, items]) => (
        <div key={folder}>
          {folder && (
            <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">{folder}</div>
          )}
          {items.map((q) => (
            <button
              key={q.id}
              type="button"
              onClick={() => { onSelect(q.queryText, q.queryLanguage); }}
              className="flex w-full items-start gap-2 rounded px-2 py-1.5 text-left hover:bg-muted/60"
            >
              <div className="flex flex-col">
                <span className="text-sm font-medium leading-tight">{q.name}</span>
                {q.description && (
                  <span className="text-xs text-muted-foreground">{q.description}</span>
                )}
              </div>
              {q.shared && (
                <span className="ml-auto rounded bg-blue-100 px-1 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                  shared
                </span>
              )}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
