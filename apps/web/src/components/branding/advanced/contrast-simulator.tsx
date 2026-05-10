'use client';

import { useThemeEditor } from '@/state/theme-editor-store';
import { useWorkspacePlan } from '@/hooks/useWorkspacePlan';

const MODES = [
  { id: 'normal', label: 'Normal' },
  { id: 'protanopia', label: 'Protanopia' },
  { id: 'deuteranopia', label: 'Deuteranopia' },
  { id: 'tritanopia', label: 'Tritanopia' },
] as const;

export function ContrastSimulator(): JSX.Element {
  const cvdMode = useThemeEditor((s) => s.cvdMode);
  const setCvdMode = useThemeEditor((s) => s.setCvdMode);
  const { can } = useWorkspacePlan();
  const enabled = can('cvdSimulator');

  return (
    <div className="rounded-md border p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Color-blindness preview
        </span>
        {!enabled ? <span className="text-[10px] text-muted-foreground">Pro</span> : null}
      </div>
      <div className="flex flex-wrap gap-1">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            disabled={!enabled && m.id !== 'normal'}
            onClick={() => setCvdMode(m.id)}
            className={`rounded border px-2 py-1 text-[11px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              cvdMode === m.id ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
    </div>
  );
}
