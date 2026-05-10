'use client';

import { useEffect, useState } from 'react';

import type { WorkspaceTheme } from '@/lib/theme/types';
import { useThemeEditor } from '@/state/theme-editor-store';

import { Button } from '@/components/ui/button';

import { PreviewSurface } from '../preview-surface';
import { CommandPalette } from './command-palette';
import { ContrastSimulator } from './contrast-simulator';
import { DiffView } from './diff-view';
import { HistoryStack } from './history-stack';
import { PrimitivesPanel } from './primitives-panel';
import { SemanticsPanel } from './semantics-panel';
import { TypographyPanel } from './typography-panel';

interface AdvancedEditorProps {
  baseline: WorkspaceTheme;
  current: WorkspaceTheme;
  onSave: () => void;
  saving: boolean;
  saveError: string | null;
}

type EditorSection = 'colors' | 'semantics' | 'typography' | 'history';

export function AdvancedEditor({ baseline, current, onSave, saving, saveError }: AdvancedEditorProps): JSX.Element {
  const [section, setSection] = useState<EditorSection>('semantics');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const undo = useThemeEditor((s) => s.undo);
  const redo = useThemeEditor((s) => s.redo);
  const reset = useThemeEditor((s) => s.reset);
  const hovered = useThemeEditor((s) => s.hoveredSemanticKeys);
  const setHovered = useThemeEditor((s) => s.setHovered);
  const pinned = useThemeEditor((s) => s.pinnedSemanticKeys);
  const togglePinned = useThemeEditor((s) => s.togglePinned);
  const setPinned = useThemeEditor((s) => s.setPinned);
  const clearPinned = useThemeEditor((s) => s.clearPinned);
  const cvdMode = useThemeEditor((s) => s.cvdMode);
  const setSelected = useThemeEditor((s) => s.setSelected);

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === 'k') {
        setPaletteOpen((o) => !o);
        e.preventDefault();
        return;
      }
      if (meta && !e.shiftKey && e.key.toLowerCase() === 'z') {
        undo();
        e.preventDefault();
      } else if (meta && e.shiftKey && e.key.toLowerCase() === 'z') {
        redo();
        e.preventDefault();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)]">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex gap-1 rounded-md border bg-card p-0.5">
            {(['semantics', 'colors', 'typography', 'history'] as EditorSection[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSection(s)}
                className={`rounded px-3 py-1 text-xs font-medium capitalize transition-colors ${
                  section === s ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setPaletteOpen(true)}>
              <span className="font-mono text-[10px] mr-1.5 rounded border px-1">⌘K</span>
              Search tokens
            </Button>
            <Button size="sm" variant="outline" onClick={reset} title="Revert to baseline">
              Reset
            </Button>
            <Button size="sm" onClick={onSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save theme'}
            </Button>
          </div>
        </div>

        {saveError ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            {saveError}
          </div>
        ) : null}

        <div className="rounded-md border bg-card p-4">
          {section === 'semantics' ? (
            <SemanticsPanel
              primitives={current.primitives}
              light={current.semantics.light}
              dark={current.semantics.dark}
              onHoverKeys={setHovered}
              highlightKeys={hovered}
              pinnedKeys={pinned}
              onTogglePinned={togglePinned}
            />
          ) : null}
          {section === 'colors' ? <PrimitivesPanel primitives={current.primitives} /> : null}
          {section === 'typography' ? <TypographyPanel fonts={current.fonts} /> : null}
          {section === 'history' ? (
            <div className="space-y-3">
              <HistoryStack />
              <DiffView baseline={baseline} current={current} onResetAll={reset} />
            </div>
          ) : null}
        </div>

        {section !== 'history' ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <HistoryStack />
            <ContrastSimulator />
          </div>
        ) : null}
      </div>

      <aside className="space-y-3 lg:sticky lg:top-4 lg:self-start">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Live preview {cvdMode !== 'normal' ? `· ${cvdMode}` : ''}
          </p>
          {pinned.length > 0 ? (
            <button
              type="button"
              onClick={clearPinned}
              className="text-[11px] text-muted-foreground hover:text-foreground"
            >
              Clear pins ({pinned.length})
            </button>
          ) : null}
        </div>
        <PreviewSurface
          theme={current}
          mode="light"
          cvd={cvdMode}
          compact
          onHoverSemantics={setHovered}
          highlightSemantics={hovered}
          pinnedSemantics={pinned}
          onPinSemantics={setPinned}
        />
        <PreviewSurface
          theme={current}
          mode="dark"
          cvd={cvdMode}
          compact
          onHoverSemantics={setHovered}
          highlightSemantics={hovered}
          pinnedSemantics={pinned}
          onPinSemantics={setPinned}
        />
      </aside>

      <CommandPalette
        open={paletteOpen}
        theme={current}
        onClose={() => setPaletteOpen(false)}
        onSelect={(path) => {
          setSelected(path);
          if (path.startsWith('semantics.')) setSection('semantics');
          else setSection('colors');
        }}
      />
    </div>
  );
}
