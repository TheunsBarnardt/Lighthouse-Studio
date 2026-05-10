'use client';

import type { Fonts } from '@/lib/theme/types';
import { useThemeEditor } from '@/state/theme-editor-store';
import { useWorkspacePlan } from '@/hooks/useWorkspacePlan';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const SYSTEM_STACKS: Record<string, string> = {
  sans: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  serif: 'ui-serif, Georgia, "Times New Roman", serif',
  mono: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, monospace',
  geist: 'var(--font-geist-sans, ui-sans-serif, system-ui, sans-serif)',
};

export function TypographyPanel({ fonts }: { fonts: Fonts }): JSX.Element {
  const setFont = useThemeEditor((s) => s.setFont);
  const { can, required } = useWorkspacePlan();

  return (
    <div className="space-y-4">
      <FontRow role="sans" label="Sans" value={fonts.sans} onChange={(v) => setFont('sans', v)} />
      <FontRow role="serif" label="Serif" value={fonts.serif ?? ''} onChange={(v) => setFont('serif', v)} optional />
      <FontRow role="mono" label="Mono" value={fonts.mono} onChange={(v) => setFont('mono', v)} />
      <FontRow role="display" label="Display" value={fonts.display ?? ''} onChange={(v) => setFont('display', v)} optional />

      <div className="rounded-md border p-3 text-xs">
        <p className="font-semibold mb-1">System font stacks</p>
        <ul className="space-y-1 font-mono text-[11px] text-muted-foreground">
          {Object.entries(SYSTEM_STACKS).map(([k, v]) => (
            <li key={k} className="truncate">
              <span className="text-foreground">{k}</span> · {v}
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-md border border-dashed p-3 text-xs">
        <p className="font-semibold">Custom fonts</p>
        <p className="text-muted-foreground mt-1">
          Google Fonts {can('googleFonts') ? '✓' : `(requires ${required('googleFonts')})`} · Custom upload {' '}
          {can('customFonts') ? '✓' : `(requires ${required('customFonts')})`}
        </p>
      </div>
    </div>
  );
}

function FontRow({
  role,
  label,
  value,
  onChange,
  optional,
}: {
  role: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  optional?: boolean;
}): JSX.Element {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={`font-${role}`} className="text-xs">
        {label}
        {optional ? <span className="text-muted-foreground ml-1">(optional)</span> : null}
      </Label>
      <Input
        id={`font-${role}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="font-mono text-xs"
        placeholder={SYSTEM_STACKS[role] ?? ''}
      />
      <div
        className="rounded border bg-muted/30 px-3 py-2"
        style={{ fontFamily: value || SYSTEM_STACKS[role] || 'inherit' }}
      >
        <p className="text-base">The quick brown fox jumps over the lazy dog 0123456789</p>
      </div>
    </div>
  );
}
