'use client';

import type { WorkspaceTheme } from '@/lib/theme/types';
import { diffThemes } from '@/lib/theme/serialize';
import { Button } from '@/components/ui/button';

interface DiffViewProps {
  baseline: WorkspaceTheme;
  current: WorkspaceTheme;
  onResetAll: () => void;
}

export function DiffView({ baseline, current, onResetAll }: DiffViewProps): JSX.Element {
  const primitiveDiffs = diffThemes(current.primitives, baseline.primitives);
  const semanticDiffs: string[] = [];
  for (const mode of ['light', 'dark'] as const) {
    for (const key of Object.keys(current.semantics[mode])) {
      const a = current.semantics[mode][key];
      const b = baseline.semantics[mode][key];
      if (JSON.stringify(a) !== JSON.stringify(b)) semanticDiffs.push(`${mode}.${key}`);
    }
  }
  const total = primitiveDiffs.length + semanticDiffs.length;

  return (
    <div className="rounded-md border p-3">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-semibold">Compare to preset</p>
          <p className="text-xs text-muted-foreground">
            {total === 0 ? 'No divergence from preset baseline.' : `${total} tokens diverged from baseline.`}
          </p>
        </div>
        {total > 0 ? (
          <Button size="sm" variant="outline" onClick={onResetAll}>
            Revert all
          </Button>
        ) : null}
      </div>
      {total > 0 ? (
        <div className="grid gap-1.5 sm:grid-cols-2 max-h-60 overflow-y-auto">
          {[...primitiveDiffs.map((p) => `primitive · ${p}`), ...semanticDiffs.map((s) => `semantic · ${s}`)].map((label) => (
            <div key={label} className="rounded bg-muted/40 px-2 py-1 text-[11px] font-mono">
              {label}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
