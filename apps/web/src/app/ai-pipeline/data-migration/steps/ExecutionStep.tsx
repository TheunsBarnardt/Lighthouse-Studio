'use client';

import { useEffect, useState } from 'react';

interface ExecutionStepProps {
  planId: string;
  onStarted: (executionId: string) => void;
  onCompleted: () => void;
  onBack: () => void;
}

interface ExecutionState {
  status: 'idle' | 'snapshotting' | 'running' | 'completed' | 'failed' | 'cancelled';
  migratedRows: number;
  totalRows: number;
  failedRows: number;
  currentTable: string;
  eta: number;
  errorMessage?: string;
}

export function ExecutionStep({ planId, onStarted, onCompleted, onBack }: ExecutionStepProps) {
  const [state, setState] = useState<ExecutionState>({
    status: 'idle',
    migratedRows: 0,
    totalRows: 60650,
    failedRows: 0,
    currentTable: '',
    eta: 0,
  });

  async function start() {
    const executionId = crypto.randomUUID();
    onStarted(executionId);

    setState(s => ({ ...s, status: 'snapshotting', currentTable: 'Taking pre-migration snapshot…' }));
    await new Promise(r => setTimeout(r, 1200));

    setState(s => ({ ...s, status: 'running', currentTable: 'customers' }));

    for (let i = 0; i <= 60650; i += 1000) {
      await new Promise(r => setTimeout(r, 80));
      const eta = Math.ceil((60650 - i) / 1000 * 0.08);
      setState(s => ({ ...s, migratedRows: i, currentTable: i < 12450 ? 'customers' : 'orders', eta }));
    }

    setState(s => ({ ...s, status: 'completed', migratedRows: 60650, eta: 0 }));
    setTimeout(onCompleted, 600);
  }

  async function cancel() {
    setState(s => ({ ...s, status: 'cancelled' }));
  }

  const progress = state.totalRows > 0 ? (state.migratedRows / state.totalRows) * 100 : 0;

  return (
    <div className="p-6 max-w-xl mx-auto space-y-5">
      <div>
        <h2 className="text-base font-semibold text-foreground mb-1">Migration Execution</h2>
        <p className="text-sm text-muted-foreground">
          Migration runs in batches of 1,000 rows. A pre-migration snapshot is taken first.
        </p>
      </div>

      {state.status === 'idle' && (
        <div className="space-y-4">
          <div className="border border-border rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium text-foreground">Ready to execute</p>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>✓ Pre-migration snapshot will be taken first</li>
              <li>✓ 60,650 rows will be migrated in 61 batches</li>
              <li>✓ Fail-on-batch-error mode (5% threshold)</li>
              <li>✓ Rollback available for 24 hours after completion</li>
            </ul>
          </div>
          <div className="flex gap-3">
            <button onClick={onBack} className="px-4 py-2 text-sm border border-border rounded-md">Back</button>
            <button
              onClick={start}
              className="px-4 py-2 bg-primary text-primary-foreground text-sm rounded-md"
            >
              Start Migration
            </button>
          </div>
        </div>
      )}

      {(state.status === 'snapshotting' || state.status === 'running') && (
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-foreground">{state.currentTable}</span>
              <span className="text-muted-foreground">{state.migratedRows.toLocaleString()} / {state.totalRows.toLocaleString()}</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{Math.round(progress)}% complete</span>
              {state.eta > 0 && <span>ETA: {state.eta}s</span>}
              {state.failedRows > 0 && <span className="text-destructive">{state.failedRows} errors</span>}
            </div>
          </div>
          <button
            onClick={cancel}
            className="px-4 py-2 text-sm border border-border rounded-md text-destructive border-destructive/50 hover:bg-destructive/5"
          >
            Cancel Migration
          </button>
        </div>
      )}

      {state.status === 'completed' && (
        <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 rounded-md">
          <span className="text-sm text-green-800 dark:text-green-200 font-medium">
            Migration complete — {state.migratedRows.toLocaleString()} rows migrated. Proceeding to validation…
          </span>
        </div>
      )}

      {state.status === 'cancelled' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-md">
            <span className="text-sm text-amber-800 dark:text-amber-200">
              Migration cancelled. Partial data remains in target. Use rollback to restore the snapshot.
            </span>
          </div>
          <div className="flex gap-3">
            <button onClick={onBack} className="px-4 py-2 text-sm border border-border rounded-md">Back</button>
            <button
              className="px-4 py-2 text-sm border border-destructive/50 text-destructive rounded-md hover:bg-destructive/5"
            >
              Rollback to Snapshot
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
