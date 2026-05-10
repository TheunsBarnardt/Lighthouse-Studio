'use client';

import { useMemo, useState } from 'react';

import type { WorkspaceTheme } from '@/lib/theme/types';
import { PRESETS, buildThemeFromPreset, getPreset } from '@/lib/theme/preset-themes';
import { hexToHsl, hslToHex, parseHslTuple } from '@/lib/theme/color';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { PreviewSurface } from './preview-surface';

interface PresetPickerProps {
  theme: WorkspaceTheme;
  onApplyPreset: (presetId: string) => void;
  onCustomize: (next: WorkspaceTheme) => void;
  onSave: () => void;
  saving: boolean;
  saveError: string | null;
  user: string;
}

const RADIUS_OPTIONS = [
  { label: 'None', value: '0rem' },
  { label: 'Subtle', value: '0.25rem' },
  { label: 'Default', value: '0.5rem' },
  { label: 'Smooth', value: '0.75rem' },
  { label: 'Round', value: '1rem' },
];

export function PresetPicker({
  theme,
  onApplyPreset,
  onCustomize,
  onSave,
  saving,
  saveError,
  user,
}: PresetPickerProps): JSX.Element {
  const activePresetId = theme.presetId ?? null;
  const [hex, setHex] = useState(() => {
    try {
      return hslToHex(parseHslTuple(theme.primitives.colors.primary?.base ?? '220 90% 56%'));
    } catch {
      return '#2563eb';
    }
  });

  const familyGroups = useMemo(() => {
    const neutral = PRESETS.filter((p) => p.family === 'neutral');
    const colored = PRESETS.filter((p) => p.family === 'colored');
    return { neutral, colored };
  }, []);

  function applyPrimaryHex(value: string): void {
    setHex(value);
    try {
      const hsl = hexToHsl(value);
      const next: WorkspaceTheme = {
        ...theme,
        source: 'custom',
        primitives: {
          ...theme.primitives,
          colors: {
            ...theme.primitives.colors,
            primary: {
              ...theme.primitives.colors.primary!,
              base: `${hsl.h.toFixed(2)} ${hsl.s.toFixed(2)}% ${hsl.l.toFixed(2)}%`,
            },
          },
        },
      };
      onCustomize(next);
    } catch {
      /* invalid hex; ignore */
    }
  }

  function applyRadius(value: string): void {
    onCustomize({ ...theme, radiusBase: value, source: 'custom' });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="space-y-6">
        <section>
          <h3 className="text-sm font-semibold mb-3">Neutral palettes</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {familyGroups.neutral.map((p) => (
              <PresetTile
                key={p.id}
                preset={p}
                active={activePresetId === p.id}
                onClick={() => onApplyPreset(p.id)}
                user={user}
              />
            ))}
          </div>
        </section>

        <section>
          <h3 className="text-sm font-semibold mb-3">Color accents</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {familyGroups.colored.map((p) => (
              <PresetTile
                key={p.id}
                preset={p}
                active={activePresetId === p.id}
                onClick={() => onApplyPreset(p.id)}
                user={user}
              />
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <Label htmlFor="primary-hex" className="text-sm font-semibold">
              Primary color
            </Label>
            <p className="text-xs text-muted-foreground mb-2">Tweak the preset's primary hue.</p>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={hex}
                onChange={(e) => applyPrimaryHex(e.target.value)}
                className="h-9 w-12 rounded border border-border cursor-pointer bg-background"
                aria-label="Primary color"
              />
              <Input
                id="primary-hex"
                value={hex}
                onChange={(e) => applyPrimaryHex(e.target.value)}
                placeholder="#2563eb"
                className="font-mono"
              />
            </div>
          </div>

          <div>
            <Label className="text-sm font-semibold">Border radius</Label>
            <div className="mt-2 grid grid-cols-5 gap-1.5">
              {RADIUS_OPTIONS.map((opt) => {
                const active = theme.radiusBase === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => applyRadius(opt.value)}
                    className={`h-9 rounded-md border text-xs transition-colors ${
                      active
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-background hover:bg-muted'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <div className="flex items-center justify-between gap-3 pt-3 border-t">
          <p className="text-xs text-muted-foreground">
            Saved themes apply to every project in this workspace.
          </p>
          <Button onClick={onSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save theme'}
          </Button>
        </div>
        {saveError ? (
          <p className="text-xs text-destructive" role="alert">
            {saveError}
          </p>
        ) : null}
      </div>

      <div className="space-y-3 lg:sticky lg:top-4 lg:self-start">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Live preview</p>
        <PreviewSurface theme={theme} mode="light" compact />
        <PreviewSurface theme={theme} mode="dark" compact />
      </div>
    </div>
  );
}

function PresetTile({
  preset,
  active,
  onClick,
  user,
}: {
  preset: ReturnType<typeof getPreset> & object;
  active: boolean;
  onClick: () => void;
  user: string;
}): JSX.Element {
  const sample = useMemo(() => buildThemeFromPreset(preset, { user }), [preset, user]);
  const primary = `hsl(${sample.primitives.colors.primary!.steps['500']})`;
  const muted = `hsl(${sample.primitives.colors.neutral!.steps['200']})`;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex flex-col gap-1.5 rounded-md border p-2.5 text-left transition-colors ${
        active ? 'border-primary ring-2 ring-primary/40' : 'border-border hover:border-primary/40'
      }`}
      aria-pressed={active}
    >
      <div className="flex items-center gap-1.5">
        <span className="h-4 w-4 rounded-full" style={{ background: primary }} />
        <span className="h-4 w-4 rounded-full" style={{ background: muted }} />
        <span className="text-xs font-semibold">{preset.label}</span>
      </div>
      <span className="text-[10px] text-muted-foreground line-clamp-2">{preset.description}</span>
    </button>
  );
}
