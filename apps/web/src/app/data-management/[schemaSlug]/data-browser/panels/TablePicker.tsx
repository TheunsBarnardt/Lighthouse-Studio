'use client';

interface TableInfo {
  id: string;
  name: string;
  rowCount?: number;
}

interface TablePickerProps {
  tables: TableInfo[];
  selectedTableId: string | null;
  onSelect: (tableId: string) => void;
  loading?: boolean;
}

export function TablePicker({ tables, selectedTableId, onSelect, loading }: TablePickerProps) {
  return (
    <aside
      className="flex h-full w-56 flex-col border-r border-border bg-muted/20"
      aria-label="Table list"
    >
      <div className="border-b border-border px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Tables
        </span>
      </div>
      <nav className="flex-1 overflow-y-auto py-1">
        {loading ? (
          <div className="px-3 py-2 text-xs text-muted-foreground">Loading…</div>
        ) : tables.length === 0 ? (
          <div className="px-3 py-4 text-xs text-muted-foreground text-center">
            No tables in this schema
          </div>
        ) : (
          tables.map((table) => (
            <button
              key={table.id}
              type="button"
              className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-sm transition-colors ${
                selectedTableId === table.id
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'hover:bg-muted text-foreground'
              }`}
              onClick={() => {
                onSelect(table.id);
              }}
              aria-current={selectedTableId === table.id ? 'page' : undefined}
            >
              <span className="truncate">{table.name}</span>
              {table.rowCount !== undefined && (
                <span className="ml-1 shrink-0 text-xs text-muted-foreground">
                  {table.rowCount.toLocaleString()}
                </span>
              )}
            </button>
          ))
        )}
      </nav>
    </aside>
  );
}
