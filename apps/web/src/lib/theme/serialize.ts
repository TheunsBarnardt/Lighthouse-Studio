import type { ModeSemantics, Primitives, WorkspaceTheme } from './types';
import { resolveToken } from './alias-graph';
import { parseHslTuple, hslToHex } from './color';

export interface ResolvedMode {
  vars: Record<string, string>;
}

export function resolveMode(theme: WorkspaceTheme, mode: 'light' | 'dark'): ResolvedMode {
  const semantics: ModeSemantics = theme.semantics[mode];
  const vars: Record<string, string> = {};
  for (const [key, ref] of Object.entries(semantics)) {
    try {
      vars[`--color-${key}`] = resolveToken(ref, theme.primitives);
    } catch {
      vars[`--color-${key}`] = '0 0% 50%';
    }
  }
  for (const [k, v] of Object.entries(theme.primitives.spacing)) vars[`--spacing-${k}`] = v;
  for (const [k, v] of Object.entries(theme.primitives.fontSize)) vars[`--font-size-${k}`] = v;
  for (const [k, v] of Object.entries(theme.primitives.radius)) vars[`--radius-${k}`] = v;
  for (const [k, v] of Object.entries(theme.primitives.shadow)) vars[`--shadow-${k}`] = v;
  vars['--font-family-sans'] = theme.fonts.sans;
  vars['--font-family-mono'] = theme.fonts.mono;
  if (theme.fonts.serif) vars['--font-family-serif'] = theme.fonts.serif;
  if (theme.fonts.display) vars['--font-family-display'] = theme.fonts.display;
  return { vars };
}

export function toCssBlock(theme: WorkspaceTheme): string {
  const lines: string[] = [];
  const light = resolveMode(theme, 'light');
  const dark = resolveMode(theme, 'dark');
  lines.push(':root, [data-theme="light"] {');
  for (const [k, v] of Object.entries(light.vars)) lines.push(`  ${k}: ${v};`);
  lines.push('}');
  lines.push('[data-theme="dark"] {');
  for (const [k, v] of Object.entries(dark.vars)) lines.push(`  ${k}: ${v};`);
  lines.push('}');
  return lines.join('\n');
}

export function toTailwindV4(theme: WorkspaceTheme): string {
  const light = resolveMode(theme, 'light');
  const dark = resolveMode(theme, 'dark');
  const out: string[] = ['@theme {'];
  for (const [k, v] of Object.entries(light.vars)) {
    if (k.startsWith('--color-')) out.push(`  ${k}: hsl(${v});`);
    else out.push(`  ${k}: ${v};`);
  }
  out.push('}');
  out.push('');
  out.push('@layer base {');
  out.push('  [data-theme="dark"] {');
  for (const [k, v] of Object.entries(dark.vars)) {
    if (k.startsWith('--color-')) out.push(`    ${k}: hsl(${v});`);
  }
  out.push('  }');
  out.push('}');
  return out.join('\n');
}

export function toJsonDtcg(theme: WorkspaceTheme): string {
  const colors: Record<string, unknown> = {};
  for (const [name, scale] of Object.entries(theme.primitives.colors)) {
    const group: Record<string, unknown> = {
      base: { $type: 'color', $value: hslToHex(parseHslTuple(scale.base)) },
    };
    for (const [step, tuple] of Object.entries(scale.steps)) {
      group[step] = { $type: 'color', $value: hslToHex(parseHslTuple(tuple)) };
    }
    colors[name] = group;
  }
  const out = {
    $schema: 'https://design-tokens.github.io/community-group/format/',
    color: colors,
    spacing: mapDtcg(theme.primitives.spacing, 'dimension'),
    fontSize: mapDtcg(theme.primitives.fontSize, 'dimension'),
    radius: mapDtcg(theme.primitives.radius, 'dimension'),
    shadow: mapDtcg(theme.primitives.shadow, 'shadow'),
  };
  return JSON.stringify(out, null, 2);
}

function mapDtcg(bag: Record<string, string>, type: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(bag)) out[k] = { $type: type, $value: v };
  return out;
}

export function toTypeScript(theme: WorkspaceTheme): string {
  return [
    '// Generated workspace theme — do not edit by hand.',
    `export const workspaceTheme = ${JSON.stringify(theme, null, 2)} as const;`,
  ].join('\n');
}

export type ExportFormat = 'css' | 'tailwind' | 'json-dtcg' | 'typescript';

export function exportTheme(theme: WorkspaceTheme, format: ExportFormat): string {
  switch (format) {
    case 'css':
      return toCssBlock(theme);
    case 'tailwind':
      return toTailwindV4(theme);
    case 'json-dtcg':
      return toJsonDtcg(theme);
    case 'typescript':
      return toTypeScript(theme);
  }
}

export function diffThemes(a: Primitives, b: Primitives): string[] {
  const diffs: string[] = [];
  for (const [name, scale] of Object.entries(a.colors)) {
    const other = b.colors[name] as typeof scale | undefined;
    if (other === undefined) {
      diffs.push(`colors.${name} (added)`);
      continue;
    }
    if (scale.base !== other.base) diffs.push(`colors.${name}.base`);
    for (const step of Object.keys(scale.steps)) {
      if (scale.steps[step] !== other.steps[step]) diffs.push(`colors.${name}.${step}`);
    }
  }
  for (const group of ['spacing', 'fontSize', 'radius', 'shadow'] as const) {
    for (const [k, v] of Object.entries(a[group])) {
      if (b[group][k] !== v) diffs.push(`${group}.${k}`);
    }
  }
  return diffs;
}
