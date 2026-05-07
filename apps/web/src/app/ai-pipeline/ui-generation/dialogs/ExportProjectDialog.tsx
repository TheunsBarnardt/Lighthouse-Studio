'use client';

import { useState } from 'react';

interface ExportProjectDialogProps {
  projectId: string;
  onClose: () => void;
}

type ExportFormat = 'zip' | 'github' | 'stackblitz';

export function ExportProjectDialog({ projectId: _projectId, onClose }: ExportProjectDialogProps) {
  const [format, setFormat] = useState<ExportFormat>('zip');
  const [isExporting, setIsExporting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleExport() {
    setIsExporting(true);
    await new Promise(r => setTimeout(r, 2000));
    setIsExporting(false);
    setDone(true);
  }

  if (done) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-background border border-border rounded-lg w-full max-w-md p-6 space-y-4">
          <div className="text-center space-y-2">
            <div className="text-3xl">✓</div>
            <h2 className="text-sm font-semibold text-foreground">Export complete</h2>
            {format === 'zip' && (
              <p className="text-xs text-muted-foreground">
                <span className="font-mono">project.zip</span> has been downloaded to your computer.
              </p>
            )}
            {format === 'github' && (
              <p className="text-xs text-muted-foreground">Repository created and pushed.</p>
            )}
            {format === 'stackblitz' && (
              <p className="text-xs text-muted-foreground">Project opened in StackBlitz.</p>
            )}
          </div>
          <div className="flex justify-center">
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-xs bg-primary text-primary-foreground rounded-md"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background border border-border rounded-lg w-full max-w-md p-6 space-y-5">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Export Project</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Download the complete React application with all approved components.
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-foreground">Export format</p>
          <div className="space-y-1.5">
            {([
              { id: 'zip', label: 'Download as ZIP', desc: 'Get a .zip file with the full project' },
              { id: 'github', label: 'Push to GitHub', desc: 'Create a new repository in your account' },
              { id: 'stackblitz', label: 'Open in StackBlitz', desc: 'Edit instantly in the browser' },
            ] as { id: ExportFormat; label: string; desc: string }[]).map(opt => (
              <label key={opt.id} className="flex items-start gap-3 p-3 border border-border rounded-md cursor-pointer hover:bg-muted/30">
                <input
                  type="radio"
                  name="format"
                  value={opt.id}
                  checked={format === opt.id}
                  onChange={() => setFormat(opt.id)}
                  className="mt-0.5"
                />
                <div>
                  <p className="text-xs font-medium text-foreground">{opt.label}</p>
                  <p className="text-xs text-muted-foreground">{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="bg-muted/50 rounded-md px-3 py-2 text-xs text-muted-foreground space-y-0.5">
          <p>✓ 8 components approved · 4 pending</p>
          <p>✓ All approved components will be included</p>
          <p>✓ Includes package.json, vite.config, tsconfig</p>
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={isExporting}
            className="px-3 py-1.5 text-xs border border-border rounded-md hover:bg-muted disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
          >
            {isExporting ? 'Exporting…' : 'Export'}
          </button>
        </div>
      </div>
    </div>
  );
}
