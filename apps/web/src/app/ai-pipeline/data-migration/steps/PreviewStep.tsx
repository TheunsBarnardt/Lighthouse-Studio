'use client';

import { useEffect, useState } from 'react';

interface PreviewRow {
  source: Record<string, unknown>;
  target: Record<string, unknown>;
  errors: string[];
}

interface PreviewStepProps {
  planId: string;
  onContinue: () => void;
  onBack: () => void;
}

export function PreviewStep({ planId, onContinue, onBack }: PreviewStepProps) {
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sampleSize, setSampleSize] = useState(100);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      await new Promise(r => setTimeout(r, 1000));
      setRows([
        {
          source: { id: 1, full_name: 'Alice Smith', email: 'alice@example.com', created: '2024-01-01' },
          target: { id: crypto.randomUUID(), email: 'alice@example.com', created_at: '2024-01-01T00:00:00.000Z' },
          errors: [],
        },
        {
          source: { id: 2, full_name: 'Bob Jones', email: 'bob@example.com', created: '2024-02-15' },
          target: { id: crypto.randomUUID(), email: 'bob@example.com', created_at: '2024-02-15T00:00:00.000Z' },
          errors: [],
        },
      ]);
      setIsLoading(false);
    };
    load();
  }, [planId, sampleSize]);

  const errorCount = rows.filter(r => r.errors.length > 0).length;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground mb-1">Sample Preview</h2>
          <p className="text-sm text-muted-foreground">
            First {sampleSize} rows processed through your mapping. Review before running the full migration.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Sample size:</span>
          <select
            className="text-xs border border-border rounded px-2 py-1 bg-background"
            value={sampleSize}
            onChange={e => setSampleSize(Number(e.target.value))}
          >
            {[10, 50, 100, 500, 1000].map(n => (
              <option key={n} value={n}>{n} rows</option>
            ))}
          </select>
        </div>
      </div>

      {errorCount > 0 && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
          <span className="text-sm text-destructive font-medium">
            {errorCount} rows have errors — fix your mapping before proceeding
          </span>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted rounded-md animate-pulse" />)}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted">
                <th className="text-left px-3 py-2 font-medium text-muted-foreground border-r border-border" colSpan={4}>Source</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground" colSpan={3}>Target</th>
              </tr>
              <tr className="bg-muted/50 border-b border-border">
                {['id', 'full_name', 'email', 'created'].map(h => (
                  <th key={h} className="text-left px-3 py-2 font-mono text-muted-foreground border-r border-border/50">{h}</th>
                ))}
                {['id', 'email', 'created_at'].map(h => (
                  <th key={h} className="text-left px-3 py-2 font-mono text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className={`border-t border-border ${row.errors.length > 0 ? 'bg-destructive/5' : ''}`}>
                  {(['id', 'full_name', 'email', 'created'] as const).map(k => (
                    <td key={k} className="px-3 py-2 font-mono text-foreground border-r border-border/50 max-w-32 truncate">
                      {String(row.source[k] ?? '')}
                    </td>
                  ))}
                  {(['id', 'email', 'created_at'] as const).map(k => (
                    <td key={k} className="px-3 py-2 font-mono text-foreground max-w-48 truncate">
                      {String(row.target[k] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={onBack} className="px-4 py-2 text-sm border border-border rounded-md">Back</button>
        <button
          onClick={onContinue}
          disabled={isLoading || errorCount > 0}
          className="px-4 py-2 bg-primary text-primary-foreground text-sm rounded-md disabled:opacity-50"
        >
          Looks Good — Submit for Approval →
        </button>
      </div>
    </div>
  );
}
