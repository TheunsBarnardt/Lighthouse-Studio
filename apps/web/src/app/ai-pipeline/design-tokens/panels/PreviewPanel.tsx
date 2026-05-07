'use client';

import { useMemo } from 'react';

interface PreviewPanelProps {
  tokenSet: Record<string, unknown>;
  theme: 'light' | 'dark';
  onSelectToken: (path: string) => void;
  selectedTokenPath: string | null;
}

export function PreviewPanel({ tokenSet, theme, onSelectToken, selectedTokenPath }: PreviewPanelProps) {
  const cssVars = useMemo(() => buildCssVars(tokenSet, theme), [tokenSet, theme]);

  return (
    <div className="p-6 space-y-8" style={cssVars}>
      {/* Color palette grid */}
      <section>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Color Palette</h2>
        <div className="space-y-2">
          {(['primary', 'secondary', 'success', 'warning', 'danger', 'info', 'neutral'] as const).map(palette => {
            const scale = (tokenSet.colors as Record<string, unknown>)?.[palette] as Record<string, string> | undefined;
            if (!scale) return null;
            return (
              <div key={palette} className="flex items-center gap-1">
                <span className="w-20 text-xs text-gray-500 capitalize">{palette}</span>
                {(['50','100','200','300','400','500','600','700','800','900'] as const).map(shade => (
                  <button
                    key={shade}
                    title={`${palette}.${shade}: ${scale[shade]}`}
                    onClick={() => onSelectToken(`colors.${palette}.${shade}`)}
                    className={`w-8 h-8 rounded flex-shrink-0 transition-transform hover:scale-110 ${selectedTokenPath === `colors.${palette}.${shade}` ? 'ring-2 ring-offset-1 ring-blue-500' : ''}`}
                    style={{ backgroundColor: scale[shade] }}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </section>

      {/* Sample components */}
      <section>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Sample Components</h2>
        <div
          className="rounded-xl border p-6 space-y-6"
          style={{ backgroundColor: theme === 'dark' ? 'var(--preview-surface)' : 'var(--preview-surface)' }}
        >
          {/* Buttons */}
          <div className="flex flex-wrap gap-3">
            <button
              className="px-4 py-2 rounded-md text-sm font-medium text-white"
              style={{ backgroundColor: 'var(--preview-primary)', borderRadius: 'var(--preview-radius)' }}
            >
              Primary Button
            </button>
            <button
              className="px-4 py-2 rounded-md text-sm font-medium border"
              style={{ borderColor: 'var(--preview-primary)', color: 'var(--preview-primary)', borderRadius: 'var(--preview-radius)' }}
            >
              Secondary Button
            </button>
            <button
              className="px-4 py-2 rounded-md text-sm font-medium text-white"
              style={{ backgroundColor: 'var(--preview-danger)', borderRadius: 'var(--preview-radius)' }}
            >
              Destructive
            </button>
          </div>

          {/* Card */}
          <div
            className="rounded-lg border p-4"
            style={{ backgroundColor: 'var(--preview-elevated)', borderColor: 'var(--preview-border)', borderRadius: 'var(--preview-radius-lg)' }}
          >
            <h3 className="font-semibold mb-1" style={{ color: 'var(--preview-content-primary)', fontFamily: 'var(--preview-font-base)' }}>
              Card Heading
            </h3>
            <p className="text-sm" style={{ color: 'var(--preview-content-secondary)' }}>
              This is a sample card body with secondary text. It demonstrates the typography and surface colors.
            </p>
            <div className="mt-3 pt-3 border-t flex justify-end" style={{ borderColor: 'var(--preview-border)' }}>
              <button
                className="text-xs font-medium"
                style={{ color: 'var(--preview-primary)' }}
              >
                Card Action
              </button>
            </div>
          </div>

          {/* Form */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--preview-content-primary)' }}>
                Email address
              </label>
              <input
                type="email"
                placeholder="you@example.com"
                readOnly
                className="w-full px-3 py-2 text-sm border rounded"
                style={{
                  borderColor: 'var(--preview-border)',
                  borderRadius: 'var(--preview-radius)',
                  backgroundColor: 'var(--preview-surface)',
                  color: 'var(--preview-content-primary)',
                }}
              />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="sample-check" readOnly className="rounded" />
              <label htmlFor="sample-check" className="text-sm" style={{ color: 'var(--preview-content-secondary)' }}>
                I agree to the terms
              </label>
            </div>
          </div>

          {/* Typography scale */}
          <div className="space-y-1" style={{ fontFamily: 'var(--preview-font-base)' }}>
            {['4xl','3xl','2xl','xl','lg','base','sm','xs'].map(step => (
              <div key={step} style={{ fontSize: `var(--preview-text-${step})`, color: 'var(--preview-content-primary)' }}>
                {step.toUpperCase()} — The quick brown fox
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function buildCssVars(tokenSet: Record<string, unknown>, theme: 'light' | 'dark'): React.CSSProperties {
  const colors = tokenSet.colors as Record<string, unknown> | undefined;
  const themeColors = colors?.[theme] as Record<string, string> | undefined;
  const typography = tokenSet.typography as Record<string, unknown> | undefined;
  const typoScale = typography?.scale as Record<string, { fontSize: string }> | undefined;
  const borderRadius = tokenSet.borderRadius as Record<string, string> | undefined;

  return {
    '--preview-surface': themeColors?.surfaceBase ?? (theme === 'dark' ? '#111827' : '#ffffff'),
    '--preview-elevated': themeColors?.surfaceElevated ?? (theme === 'dark' ? '#1f2937' : '#f9fafb'),
    '--preview-border': themeColors?.borderDefault ?? (theme === 'dark' ? '#374151' : '#e5e7eb'),
    '--preview-content-primary': themeColors?.contentPrimary ?? (theme === 'dark' ? '#f9fafb' : '#111827'),
    '--preview-content-secondary': themeColors?.contentSecondary ?? (theme === 'dark' ? '#9ca3af' : '#6b7280'),
    '--preview-primary': (colors?.primary as Record<string, string>)?.['600'] ?? '#2563eb',
    '--preview-danger': (colors?.danger as Record<string, string>)?.['600'] ?? '#dc2626',
    '--preview-font-base': (typography?.fontFamilyBase as string) ?? 'system-ui, sans-serif',
    '--preview-radius': borderRadius?.base ?? '0.375rem',
    '--preview-radius-lg': borderRadius?.lg ?? '0.5rem',
    ...Object.fromEntries(
      ['xs','sm','base','lg','xl','2xl','3xl','4xl'].map(step => [
        `--preview-text-${step}`,
        typoScale?.[step]?.fontSize ?? '1rem',
      ])
    ),
  } as React.CSSProperties;
}
