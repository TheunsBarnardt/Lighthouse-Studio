'use client';

import { useThemeEditor } from '@/state/theme-editor-store';
import { Button } from '@/components/ui/button';

export function HistoryStack(): JSX.Element {
  const past = useThemeEditor((s) => s.past);
  const future = useThemeEditor((s) => s.future);
  const undo = useThemeEditor((s) => s.undo);
  const redo = useThemeEditor((s) => s.redo);

  const recent = past.slice(-6).reverse();

  return (
    <div className="rounded-md border p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">History</span>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" onClick={undo} disabled={past.length === 0} title="Cmd+Z">
            Undo
          </Button>
          <Button size="sm" variant="outline" onClick={redo} disabled={future.length === 0} title="Cmd+Shift+Z">
            Redo
          </Button>
        </div>
      </div>
      {recent.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">No edits yet.</p>
      ) : (
        <ul className="space-y-1 text-[11px] font-mono">
          {recent.map((entry, i) => (
            <li key={i} className="truncate text-muted-foreground" title={entry.label}>
              · {entry.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
