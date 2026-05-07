'use client';

import { useEffect, useState } from 'react';

interface SourceTableInfo {
  name: string;
  rowCount: number;
  columns: Array<{ name: string; type: string; nullable: boolean }>;
}

interface IntrospectionStepProps {
  sourceConnectionId: string;
  onContinue: () => void;
  onBack: () => void;
}

export function IntrospectionStep({ sourceConnectionId, onContinue, onBack }: IntrospectionStepProps) {
  const [tables, setTables] = useState<SourceTableInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      await new Promise(r => setTimeout(r, 1200));
      setTables([
        { name: 'customers', rowCount: 12450, columns: [
          { name: 'id', type: 'integer', nullable: false },
          { name: 'full_name', type: 'varchar(255)', nullable: false },
          { name: 'email', type: 'varchar(255)', nullable: false },
          { name: 'created', type: 'timestamp', nullable: false },
        ]},
        { name: 'orders', rowCount: 48200, columns: [
          { name: 'id', type: 'integer', nullable: false },
          { name: 'customer_id', type: 'integer', nullable: false },
          { name: 'total', type: 'decimal(10,2)', nullable: false },
          { name: 'status', type: 'varchar(20)', nullable: false },
        ]},
      ]);
      setIsLoading(false);
    };
    load();
  }, [sourceConnectionId]);

  const totalRows = tables.reduce((n, t) => n + t.rowCount, 0);

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-5">
      <div>
        <h2 className="text-base font-semibold text-foreground mb-1">Source Introspection</h2>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Scanning source schema and sampling rows…</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Found <strong>{tables.length}</strong> tables with{' '}
            <strong>{totalRows.toLocaleString()}</strong> total rows.
          </p>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-12 bg-muted rounded-md animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {tables.map(table => (
            <div key={table.name} className="border border-border rounded-lg overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-4 py-3 bg-card hover:bg-muted/50 text-left"
                onClick={() => setExpanded(expanded === table.name ? null : table.name)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-foreground">{table.name}</span>
                  <span className="text-xs text-muted-foreground">{table.columns.length} columns</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{table.rowCount.toLocaleString()} rows</span>
                  <span className="text-xs text-muted-foreground">{expanded === table.name ? '▲' : '▼'}</span>
                </div>
              </button>
              {expanded === table.name && (
                <div className="border-t border-border px-4 py-3 bg-background">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-muted-foreground">
                        <th className="text-left font-medium pb-1">Column</th>
                        <th className="text-left font-medium pb-1">Type</th>
                        <th className="text-left font-medium pb-1">Nullable</th>
                      </tr>
                    </thead>
                    <tbody>
                      {table.columns.map(col => (
                        <tr key={col.name} className="border-t border-border/50">
                          <td className="py-1 font-mono text-foreground">{col.name}</td>
                          <td className="py-1 text-muted-foreground">{col.type}</td>
                          <td className="py-1 text-muted-foreground">{col.nullable ? 'Yes' : 'No'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button onClick={onBack} className="px-4 py-2 text-sm border border-border rounded-md">Back</button>
        <button
          onClick={onContinue}
          disabled={isLoading || tables.length === 0}
          className="px-4 py-2 bg-primary text-primary-foreground text-sm rounded-md disabled:opacity-50"
        >
          Generate Mapping →
        </button>
      </div>
    </div>
  );
}
