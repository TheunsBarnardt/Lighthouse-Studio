import { describe, expect, it } from 'vitest';

import { exportTheme, resolveMode } from './serialize';
import { buildDefaultTheme } from './preset-themes';

const theme = buildDefaultTheme();

describe('resolveMode', () => {
  it('produces CSS vars for light mode', () => {
    const { vars } = resolveMode(theme, 'light');
    expect(vars['--color-background']).toBeTruthy();
    expect(vars['--color-primary']).toBeTruthy();
    expect(vars['--radius-md']).toBeTruthy();
  });
});

describe('exportTheme', () => {
  it('emits CSS block', () => {
    const css = exportTheme(theme, 'css');
    expect(css).toContain(':root');
    expect(css).toContain('--color-primary');
  });

  it('emits Tailwind v4 @theme', () => {
    const tw = exportTheme(theme, 'tailwind');
    expect(tw).toContain('@theme');
    expect(tw).toContain('hsl(');
  });

  it('emits DTCG JSON', () => {
    const json = exportTheme(theme, 'json-dtcg');
    const parsed = JSON.parse(json) as { color: Record<string, unknown> };
    expect(parsed.color).toBeTruthy();
    expect(parsed.color.primary).toBeTruthy();
  });

  it('emits TypeScript', () => {
    const ts = exportTheme(theme, 'typescript');
    expect(ts).toContain('export const workspaceTheme');
  });
});
