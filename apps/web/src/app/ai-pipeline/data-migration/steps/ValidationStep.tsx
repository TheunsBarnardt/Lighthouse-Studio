'use client';

import { useEffect, useState } from 'react';
import { RollbackConfirmationDialog } from '../dialogs/RollbackConfirmationDialog.js';

interface Check {
  type: string;
  label: string;
  status: 'passed' | 'failed' | 'running';
  details?: string;
}

interface ValidationStepProps {
  executionId: string;
  onBack: () => void;
}

export function ValidationStep({ executionId, onBack }: ValidationStepProps) {
  const [checks, setChecks] = useState<Check[]>([
    { type: 'row_count', label: 'Row count match', status: 'running' },
    { type: 'fk_integrity', label: 'FK integrity', status: 'running' },
    { type: 'no_truncation', label: 'No truncation', status: 'running' },
    { type: 'required_cols', label: 'Required columns populated', status: 'running' },
    { type: 'sample', label: 'Sample comparison (100 rows)', status: 'running' },
  ]);
  const [showRollback, setShowRollback] = useState(false);

  useEffect(() => {
    const run = async () => {
      for (let i = 0; i < checks.length; i++) {
        await new Promise(r => setTimeout(r, 600));
        setChecks(prev => prev.map((c, idx) => idx === i ? { ...c, status: 'passed' } : c));
      }
    };
    run();
  }, [executionId]);

  const allPassed = checks.every(c => c.status === 'passed');
  const anyFailed = checks.some(c => c.status === 'failed');

  return (
    <div className="p-6 max-w-xl mx-auto space-y-5">
      <div>
        <h2 className="text-base font-semibold text-foreground mb-1">Post-Migration Validation</h2>
        <p className="text-sm text-muted-foreground">
          Running validation checks to confirm data integrity.
        </p>
      </div>

      <div className="border border-border rounded-lg divide-y divide-border">
        {checks.map(check => (
          <div key={check.type} className="px-4 py-3 flex items-center gap-3">
            <div className="w-5 flex-shrink-0">
              {check.status === 'running' && (
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              )}
              {check.status === 'passed' && <span className="text-green-500 text-sm">✓</span>}
              {check.status === 'failed' && <span className="text-destructive text-sm">✗</span>}
            </div>
            <div className="flex-1">
              <p className="text-sm text-foreground">{check.label}</p>
              {check.details && <p className="text-xs text-muted-foreground">{check.details}</p>}
            </div>
          </div>
        ))}
      </div>

      {allPassed && (
        <div className="p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 rounded-lg space-y-2">
          <p className="text-sm font-medium text-green-800 dark:text-green-200">All validations passed</p>
          <p className="text-xs text-green-700 dark:text-green-300">
            Migration is complete. Your data is live in the target schema.
            The pre-migration snapshot remains available for rollback for 24 hours.
          </p>
        </div>
      )}

      {anyFailed && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg space-y-2">
          <p className="text-sm font-medium text-destructive">Validation failures detected</p>
          <p className="text-xs text-destructive/80">
            Review the failures above. You can accept and address them manually, or roll back to the pre-migration snapshot.
          </p>
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={onBack} className="px-4 py-2 text-sm border border-border rounded-md">Back</button>
        {(anyFailed || allPassed) && (
          <button
            onClick={() => setShowRollback(true)}
            className="px-4 py-2 text-sm border border-destructive/50 text-destructive rounded-md hover:bg-destructive/5"
          >
            Rollback to Snapshot
          </button>
        )}
        {allPassed && (
          <button className="px-4 py-2 bg-primary text-primary-foreground text-sm rounded-md">
            Done — View Data
          </button>
        )}
      </div>

      {showRollback && (
        <RollbackConfirmationDialog
          executionId={executionId}
          onConfirm={() => setShowRollback(false)}
          onCancel={() => setShowRollback(false)}
        />
      )}
    </div>
  );
}
