import type { WorkspaceTheme } from './types';
import type { Hsl } from './color';
import { generateScale, hexToHsl, formatHslTuple } from './color';

export interface PresetDefinition {
  id: string;
  label: string;
  family: 'neutral' | 'colored';
  primary: string;
  neutral: string;
  description: string;
}

export const PRESETS: PresetDefinition[] = [
  { id: 'zinc', label: 'Zinc', family: 'neutral', primary: '#18181b', neutral: '#71717a', description: 'Neutral grayscale, default shadcn aesthetic.' },
  { id: 'slate', label: 'Slate', family: 'neutral', primary: '#0f172a', neutral: '#64748b', description: 'Cool gray, slightly blue.' },
  { id: 'stone', label: 'Stone', family: 'neutral', primary: '#1c1917', neutral: '#78716c', description: 'Warm gray, slightly brown.' },
  { id: 'gray', label: 'Gray', family: 'neutral', primary: '#111827', neutral: '#6b7280', description: 'Pure neutral.' },
  { id: 'neutral', label: 'Neutral', family: 'neutral', primary: '#171717', neutral: '#737373', description: 'True grayscale.' },
  { id: 'red', label: 'Red', family: 'colored', primary: '#dc2626', neutral: '#71717a', description: 'Bold and energetic.' },
  { id: 'rose', label: 'Rose', family: 'colored', primary: '#e11d48', neutral: '#71717a', description: 'Romantic, vibrant pink-red.' },
  { id: 'orange', label: 'Orange', family: 'colored', primary: '#ea580c', neutral: '#78716c', description: 'Warm and friendly.' },
  { id: 'amber', label: 'Amber', family: 'colored', primary: '#d97706', neutral: '#78716c', description: 'Sunny golden tone.' },
  { id: 'yellow', label: 'Yellow', family: 'colored', primary: '#ca8a04', neutral: '#78716c', description: 'Bright and optimistic.' },
  { id: 'lime', label: 'Lime', family: 'colored', primary: '#65a30d', neutral: '#71717a', description: 'Fresh, zesty green.' },
  { id: 'green', label: 'Green', family: 'colored', primary: '#16a34a', neutral: '#71717a', description: 'Natural, growth-oriented.' },
  { id: 'emerald', label: 'Emerald', family: 'colored', primary: '#059669', neutral: '#64748b', description: 'Lush, premium green.' },
  { id: 'teal', label: 'Teal', family: 'colored', primary: '#0d9488', neutral: '#64748b', description: 'Calm, balanced.' },
  { id: 'cyan', label: 'Cyan', family: 'colored', primary: '#0891b2', neutral: '#64748b', description: 'Cool, technical.' },
  { id: 'sky', label: 'Sky', family: 'colored', primary: '#0284c7', neutral: '#64748b', description: 'Open, airy blue.' },
  { id: 'blue', label: 'Blue', family: 'colored', primary: '#2563eb', neutral: '#64748b', description: 'Classic, trustworthy.' },
  { id: 'indigo', label: 'Indigo', family: 'colored', primary: '#4f46e5', neutral: '#64748b', description: 'Deep, contemplative.' },
  { id: 'violet', label: 'Violet', family: 'colored', primary: '#7c3aed', neutral: '#71717a', description: 'Creative, modern.' },
  { id: 'purple', label: 'Purple', family: 'colored', primary: '#9333ea', neutral: '#71717a', description: 'Royal, distinctive.' },
  { id: 'fuchsia', label: 'Fuchsia', family: 'colored', primary: '#c026d3', neutral: '#71717a', description: 'Bold, playful.' },
  { id: 'pink', label: 'Pink', family: 'colored', primary: '#db2777', neutral: '#71717a', description: 'Vibrant, expressive.' },
];

const TUPLE = (h: Hsl): string => formatHslTuple(h);
const SCALE = (hex: string): Record<string, string> => {
  const base = hexToHsl(hex);
  const scale = generateScale(base);
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(scale)) out[k] = TUPLE(v);
  return out;
};

const STATIC_COLORS = {
  success: '#16a34a',
  warning: '#d97706',
  error: '#dc2626',
  info: '#2563eb',
};

export function buildThemeFromPreset(preset: PresetDefinition, options: {
  radius?: string;
  user: string;
} = { user: 'system' }): WorkspaceTheme {
  const primaryBase = TUPLE(hexToHsl(preset.primary));
  const neutralBase = TUPLE(hexToHsl(preset.neutral));
  const successBase = TUPLE(hexToHsl(STATIC_COLORS.success));
  const warningBase = TUPLE(hexToHsl(STATIC_COLORS.warning));
  const errorBase = TUPLE(hexToHsl(STATIC_COLORS.error));
  const infoBase = TUPLE(hexToHsl(STATIC_COLORS.info));

  const primaries = SCALE(preset.primary);
  const neutrals = SCALE(preset.neutral);
  const successes = SCALE(STATIC_COLORS.success);
  const warnings = SCALE(STATIC_COLORS.warning);
  const errors = SCALE(STATIC_COLORS.error);
  const infos = SCALE(STATIC_COLORS.info);

  return {
    version: 1,
    source: 'preset',
    presetId: preset.id,
    primitives: {
      colors: {
        primary: { base: primaryBase, steps: primaries },
        neutral: { base: neutralBase, steps: neutrals },
        success: { base: successBase, steps: successes },
        warning: { base: warningBase, steps: warnings },
        error: { base: errorBase, steps: errors },
        info: { base: infoBase, steps: infos },
      },
      spacing: {
        '0': '0',
        '1': '0.25rem',
        '2': '0.5rem',
        '3': '0.75rem',
        '4': '1rem',
        '5': '1.25rem',
        '6': '1.5rem',
        '8': '2rem',
        '10': '2.5rem',
        '12': '3rem',
      },
      fontSize: {
        xs: '0.75rem',
        sm: '0.875rem',
        base: '1rem',
        lg: '1.125rem',
        xl: '1.25rem',
        '2xl': '1.5rem',
        '3xl': '1.875rem',
        '4xl': '2.25rem',
      },
      radius: {
        xs: '0.125rem',
        sm: '0.25rem',
        md: '0.5rem',
        lg: '0.75rem',
        xl: '1rem',
      },
      shadow: {
        sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
        lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
      },
    },
    semantics: {
      light: {
        background: { value: '0 0% 100%' },
        foreground: { ref: 'primitives.colors.neutral.900' },
        card: { value: '0 0% 100%' },
        'card-foreground': { ref: 'primitives.colors.neutral.900' },
        primary: { ref: 'primitives.colors.primary.600' },
        'primary-foreground': { value: '0 0% 100%' },
        secondary: { ref: 'primitives.colors.neutral.100' },
        'secondary-foreground': { ref: 'primitives.colors.neutral.900' },
        muted: { ref: 'primitives.colors.neutral.100' },
        'muted-foreground': { ref: 'primitives.colors.neutral.500' },
        accent: { ref: 'primitives.colors.primary.100' },
        'accent-foreground': { ref: 'primitives.colors.primary.700' },
        destructive: { ref: 'primitives.colors.error.500' },
        'destructive-foreground': { value: '0 0% 100%' },
        border: { ref: 'primitives.colors.neutral.200' },
        input: { ref: 'primitives.colors.neutral.200' },
        ring: { ref: 'primitives.colors.primary.500' },
        success: { ref: 'primitives.colors.success.500' },
        warning: { ref: 'primitives.colors.warning.500' },
        error: { ref: 'primitives.colors.error.500' },
        info: { ref: 'primitives.colors.info.500' },
      },
      dark: {
        background: { ref: 'primitives.colors.neutral.900' },
        foreground: { ref: 'primitives.colors.neutral.50' },
        card: { ref: 'primitives.colors.neutral.900' },
        'card-foreground': { ref: 'primitives.colors.neutral.50' },
        primary: { ref: 'primitives.colors.primary.400' },
        'primary-foreground': { ref: 'primitives.colors.primary.900' },
        secondary: { ref: 'primitives.colors.neutral.800' },
        'secondary-foreground': { ref: 'primitives.colors.neutral.50' },
        muted: { ref: 'primitives.colors.neutral.800' },
        'muted-foreground': { ref: 'primitives.colors.neutral.400' },
        accent: { ref: 'primitives.colors.primary.800' },
        'accent-foreground': { ref: 'primitives.colors.primary.100' },
        destructive: { ref: 'primitives.colors.error.500' },
        'destructive-foreground': { value: '0 0% 100%' },
        border: { ref: 'primitives.colors.neutral.800' },
        input: { ref: 'primitives.colors.neutral.800' },
        ring: { ref: 'primitives.colors.primary.500' },
        success: { ref: 'primitives.colors.success.400' },
        warning: { ref: 'primitives.colors.warning.400' },
        error: { ref: 'primitives.colors.error.500' },
        info: { ref: 'primitives.colors.info.400' },
      },
    },
    fonts: {
      sans: 'var(--font-geist-sans, ui-sans-serif, system-ui, sans-serif)',
      mono: 'var(--font-geist-mono, ui-monospace, SFMono-Regular, Consolas, monospace)',
    },
    radiusBase: options.radius ?? '0.5rem',
    updatedAt: new Date().toISOString(),
    updatedBy: options.user,
  };
}

export const DEFAULT_PRESET_ID = 'emerald';

export function getPreset(id: string): PresetDefinition | undefined {
  return PRESETS.find((p) => p.id === id);
}

export function buildDefaultTheme(user = 'system'): WorkspaceTheme {
  const preset = getPreset(DEFAULT_PRESET_ID) ?? PRESETS[0];
  if (preset === undefined) throw new Error('No presets defined');
  return buildThemeFromPreset(preset, { user });
}
