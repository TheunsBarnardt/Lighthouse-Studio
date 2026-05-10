'use client';

import { useMemo, useState } from 'react';

import type { WorkspaceTheme } from '@/lib/theme/types';
import { exportTheme, type ExportFormat } from '@/lib/theme/serialize';
import { useWorkspacePlan } from '@/hooks/useWorkspacePlan';

import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';

const FORMATS: { id: ExportFormat; label: string; ext: string }[] = [
  { id: 'css', label: 'CSS variables', ext: 'css' },
  { id: 'tailwind', label: 'Tailwind v4 @theme', ext: 'css' },
  { id: 'json-dtcg', label: 'JSON (DTCG / Tokens Studio)', ext: 'json' },
  { id: 'typescript', label: 'TypeScript', ext: 'ts' },
];

export function ThemeExportDialog({ theme }: { theme: WorkspaceTheme }): JSX.Element {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<ExportFormat>('css');
  const [copied, setCopied] = useState(false);
  const { can } = useWorkspacePlan();

  const output = useMemo(() => exportTheme(theme, format), [theme, format]);

  async function copy(): Promise<void> {
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  function download(): void {
    const fmt = FORMATS.find((f) => f.id === format);
    if (!fmt) return;
    const blob = new Blob([output], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workspace-theme.${fmt.ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Export
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        size="full"
        title="Export theme"
        description="Use these tokens in any project. The DTCG export is round-trippable with Figma's Tokens Studio plugin."
      >
        <div className="flex flex-wrap gap-1.5 mb-3">
          {FORMATS.map((f) => {
            const locked = f.id === 'typescript' && !can('exportTypescript');
            return (
              <button
                key={f.id}
                type="button"
                disabled={locked}
                onClick={() => setFormat(f.id)}
                className={`rounded-md border px-3 py-1.5 text-xs transition-colors disabled:opacity-50 ${
                  format === f.id ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted'
                }`}
              >
                {f.label}
                {locked ? <span className="ml-1 text-muted-foreground">(Pro)</span> : null}
              </button>
            );
          })}
        </div>

        <pre className="max-h-[420px] overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-[11px] leading-relaxed">
          {output}
        </pre>

        <div className="flex items-center justify-end gap-2 mt-3">
          <Button size="sm" variant="outline" onClick={download}>
            Download
          </Button>
          <Button size="sm" onClick={() => void copy()}>
            {copied ? 'Copied!' : 'Copy'}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
