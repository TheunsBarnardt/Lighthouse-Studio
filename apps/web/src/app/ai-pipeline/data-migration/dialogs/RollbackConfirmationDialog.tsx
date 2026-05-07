'use client';

import { useState } from 'react';

interface RollbackConfirmationDialogProps {
  executionId: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function RollbackConfirmationDialog({ executionId, onConfirm, onCancel }: RollbackConfirmationDialogProps) {
  const [isRolling, setIsRolling] = useState(false);

  async function handleRollback() {
    setIsRolling(true);
    await new Promise(r => setTimeout(r, 1500));
    setIsRolling(false);
    onConfirm();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background border border-border rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-base font-semibold text-foreground">Rollback Migration?</h2>
        <p className="text-sm text-muted-foreground">
          This will restore all affected tables to their pre-migration state from the snapshot.
          Any data added after the migration started will be lost.
        </p>

        <div className="border border-border rounded-md p-3 space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Execution ID</span>
            <span className="font-mono text-foreground">{executionId.slice(0, 12)}…</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Snapshot taken</span>
            <span className="text-foreground">Just before execution</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tables affected</span>
            <span className="text-foreground">customers, orders</span>
          </div>
        </div>

        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
          <p className="text-xs text-destructive font-medium">
            This action cannot be undone. The snapshot will be consumed.
          </p>
        </div>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={isRolling}
            className="px-4 py-2 text-sm border border-border rounded-md"
          >
            Cancel
          </button>
          <button
            onClick={handleRollback}
            disabled={isRolling}
            className="px-4 py-2 text-sm bg-destructive text-destructive-foreground rounded-md disabled:opacity-50"
          >
            {isRolling ? 'Rolling back…' : 'Confirm Rollback'}
          </button>
        </div>
      </div>
    </div>
  );
}
