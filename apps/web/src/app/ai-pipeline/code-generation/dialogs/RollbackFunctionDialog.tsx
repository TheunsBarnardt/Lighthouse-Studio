'use client';

import { useState } from 'react';

interface RollbackFunctionDialogProps {
  functionName: string;
  onClose: () => void;
  onRollback: (version: number) => void;
}

const MOCK_VERSIONS = [
  { version: 3, createdAt: '2026-05-07 14:22', status: 'current', notes: 'Added notification threshold' },
  { version: 2, createdAt: '2026-05-07 13:45', status: 'prior', notes: 'Added retry logic' },
  { version: 1, createdAt: '2026-05-07 12:00', status: 'prior', notes: 'Initial generation' },
];

export function RollbackFunctionDialog({ functionName, onClose, onRollback }: RollbackFunctionDialogProps) {
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleRollback() {
    if (!selectedVersion) return;
    setIsSubmitting(true);
    await new Promise(r => setTimeout(r, 1000));
    onRollback(selectedVersion);
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background border border-border rounded-lg w-full max-w-md p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Rollback Function</h2>
          <p className="text-xs font-mono text-muted-foreground mt-1">{functionName}</p>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-medium text-foreground">Select target version</p>
          <div className="space-y-1">
            {MOCK_VERSIONS.map(v => (
              <label key={v.version} className={`flex items-start gap-3 p-3 border rounded-md cursor-pointer ${v.status === 'current' ? 'border-muted opacity-50 cursor-not-allowed' : 'border-border hover:bg-muted/30'}`}>
                <input
                  type="radio"
                  name="version"
                  value={v.version}
                  disabled={v.status === 'current'}
                  checked={selectedVersion === v.version}
                  onChange={() => setSelectedVersion(v.version)}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-foreground">v{v.version}</span>
                    {v.status === 'current' && <span className="text-xs text-muted-foreground">(current)</span>}
                    <span className="text-xs text-muted-foreground">{v.createdAt}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{v.notes}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900 rounded-md px-3 py-2 text-xs text-amber-800 dark:text-amber-400">
          Rolling back creates a new version (v4) with the content of the selected version. The current version is preserved.
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} disabled={isSubmitting} className="px-3 py-1.5 text-xs border border-border rounded-md hover:bg-muted disabled:opacity-50">Cancel</button>
          <button
            onClick={handleRollback}
            disabled={!selectedVersion || isSubmitting}
            className="px-3 py-1.5 text-xs bg-amber-600 text-white rounded-md hover:bg-amber-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Rolling back…' : 'Rollback'}
          </button>
        </div>
      </div>
    </div>
  );
}
