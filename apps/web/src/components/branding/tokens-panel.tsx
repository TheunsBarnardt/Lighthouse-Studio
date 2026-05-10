'use client';

import { useState } from 'react';

import type { ModeSemantics, Primitives, WorkspaceTheme } from '@/lib/theme/types';
import { resolveToken } from '@/lib/theme/alias-graph';
import { formatHslTuple, hexToHsl, hslToHex, parseHslTuple } from '@/lib/theme/color';
import { useThemeEditor } from '@/state/theme-editor-store';

import { Button } from '@/components/ui/button';

import { PreviewSurface } from './preview-surface';

interface TokensPanelProps {
  current: WorkspaceTheme;
  onSave: () => void;
  saving: boolean;
  saveError: string | null;
}

const TOKEN_GROUPS = [
  { label: 'Base', keys: ['background', 'foreground', 'border', 'input', 'ring'] },
  { label: 'Primary', keys: ['primary', 'primary-foreground'] },
  { label: 'Secondary', keys: ['secondary', 'secondary-foreground'] },
  { label: 'Muted', keys: ['muted', 'muted-foreground'] },
  { label: 'Card', keys: ['card', 'card-foreground'] },
  { label: 'Accent', keys: ['accent', 'accent-foreground'] },
  { label: 'Destructive', keys: ['destructive', 'destructive-foreground'] },
  { label: 'Semantic', keys: ['success', 'warning', 'error', 'info'] },
] as const;

function resolveColor(key: string, semantics: ModeSemantics, primitives: Primitives): string {
  const ref = semantics[key];
  if (!ref) return '0 0% 50%';
  try {
    return resolveToken(ref, primitives);
  } catch {
    return '0 0% 50%';
  }
}

export function TokensPanel({ current, onSave, saving, saveError }: TokensPanelProps): JSX.Element {
  const [mode, setMode] = useState<'light' | 'dark'>('light');
  const setSemanticRef = useThemeEditor((s) => s.setSemanticRef);

  const semantics = mode === 'light' ? current.semantics.light : current.semantics.dark;

  function handleColorChange(key: string, hex: string): void {
    try {
      const tuple = formatHslTuple(hexToHsl(hex));
      setSemanticRef(mode, key, { value: tuple });
    } catch {
      /* invalid hex */
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* Left: token editor */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div
            className="flex gap-1 rounded-md p-0.5"
            style={{ border: '1px solid var(--border-default)', background: 'var(--bg-surface-3)' }}
          >
            {(['light', 'dark'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`rounded px-3 py-1 text-xs font-medium capitalize transition-colors ${
                  mode === m
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          <Button size="sm" onClick={onSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save theme'}
          </Button>
        </div>

        {saveError ? (
          <div
            className="rounded-md px-3 py-2 text-xs"
            style={{
              border: '1px solid var(--fg-danger)',
              background: 'var(--bg-danger-subtle)',
              color: 'var(--fg-danger)',
            }}
          >
            {saveError}
          </div>
        ) : null}

        <div className="space-y-4">
          {TOKEN_GROUPS.map(({ label, keys }) => {
            const visible = (keys as readonly string[]).filter((k) => semantics[k] !== undefined);
            if (!visible.length) return null;
            return (
              <section key={label}>
                <h3
                  className="text-xs font-semibold uppercase tracking-wider mb-2"
                  style={{ color: 'var(--fg-tertiary)' }}
                >
                  {label}
                </h3>
                <div
                  className="rounded-md overflow-hidden"
                  style={{ border: '1px solid var(--border-default)' }}
                >
                  {visible.map((key, i) => {
                    const tuple = resolveColor(key, semantics, current.primitives);
                    let hex = '#808080';
                    try {
                      hex = hslToHex(parseHslTuple(tuple));
                    } catch {
                      /* use fallback */
                    }
                    const ref = semantics[key];
                    const refLabel =
                      ref && 'ref' in ref
                        ? ref.ref.replace('primitives.colors.', '').replace('primitives.', '')
                        : 'custom';

                    return (
                      <div
                        key={key}
                        className="flex items-center gap-3 px-3 py-2"
                        style={{
                          borderTop: i > 0 ? '1px solid var(--border-default)' : undefined,
                          background: 'var(--bg-surface)',
                        }}
                      >
                        {/* Color swatch — click opens native picker */}
                        <div className="relative shrink-0">
                          <div
                            className="h-6 w-6 rounded"
                            style={{
                              background: `hsl(${tuple})`,
                              border: '1px solid var(--border-default)',
                            }}
                          />
                          <input
                            type="color"
                            value={hex}
                            onChange={(e) => handleColorChange(key, e.target.value)}
                            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                            title={`Edit ${key}`}
                          />
                        </div>

                        {/* Token name */}
                        <span
                          className="flex-1 text-sm"
                          style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 12 }}
                        >
                          {key}
                        </span>

                        {/* Hex value */}
                        <span
                          className="text-xs shrink-0"
                          style={{ color: 'var(--fg-tertiary)', fontFamily: 'var(--font-geist-mono)', fontSize: 11 }}
                        >
                          {hex}
                        </span>

                        {/* Primitive reference (hidden on small screens) */}
                        <span
                          className="text-xs shrink-0 hidden sm:block"
                          style={{ color: 'var(--fg-tertiary)', fontFamily: 'var(--font-geist-mono)', fontSize: 11, minWidth: 80, textAlign: 'right' }}
                        >
                          {refLabel}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {/* Right: live preview */}
      <aside className="space-y-3 lg:sticky lg:top-4 lg:self-start">
        <p
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: 'var(--fg-tertiary)' }}
        >
          Live preview
        </p>
        <PreviewSurface theme={current} mode="light" compact />
        <PreviewSurface theme={current} mode="dark" compact />
      </aside>
    </div>
  );
}
