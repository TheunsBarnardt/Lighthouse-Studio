'use client';

interface Column {
  name: string;
  type?: string;
}

interface ResultsPanelProps {
  rows: Record<string, unknown>[];
  columns: Column[];
  rowCount: number;
  truncated: boolean;
  durationMs: number;
}

function CellValue({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground italic">NULL</span>;
  }
  if (typeof value === 'boolean') {
    return <span className="font-mono text-blue-600 dark:text-blue-400">{String(value)}</span>;
  }
  if (typeof value === 'number') {
    return <span className="font-mono text-green-700 dark:text-green-400">{String(value)}</span>;
  }
  const str = typeof value === 'object' ? JSON.stringify(value) : String(value);
  const display = str.length > 120 ? `${str.slice(0, 120)}…` : str;
  return (
    <span className="font-mono" title={str.length > 120 ? str : undefined}>
      {display}
    </span>
  );
}

export function ResultsPanel({ rows, columns, rowCount, truncated, durationMs }: ResultsPanelProps) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center gap-4 border-b px-3 py-1 text-xs text-muted-foreground">
        <span>{rowCount} row{rowCount !== 1 ? 's' : ''}</span>
        {truncated && (
          <span className="rounded bg-yellow-100 px-1.5 py-0.5 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
            Truncated — enable query.large_result to fetch more
          </span>
        )}
        <span className="ml-auto">{durationMs}ms</span>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          No rows returned
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 border-b bg-muted/50">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.name}
                    className="whitespace-nowrap px-3 py-1.5 text-left font-medium text-muted-foreground"
                  >
                    <span>{col.name}</span>
                    {col.type && (
                      <span className="ml-1 text-xs opacity-60">{col.type}</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                // biome-ignore lint: stable key for static result set
                <tr key={i} className="border-b hover:bg-muted/30">
                  {columns.map((col) => (
                    <td key={col.name} className="max-w-xs overflow-hidden px-3 py-1.5">
                      <CellValue value={row[col.name]} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
