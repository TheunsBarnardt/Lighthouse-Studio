import { SCALE_STEPS } from './types';

export interface Hsl {
  h: number;
  s: number;
  l: number;
}

export function parseHslTuple(tuple: string): Hsl {
  const m = /^([\d.]+)\s+([\d.]+)%\s+([\d.]+)%$/.exec(tuple.trim());
  if (!m) throw new Error(`Invalid HSL tuple: ${tuple}`);
  return { h: Number(m[1]), s: Number(m[2]), l: Number(m[3]) };
}

export function formatHslTuple({ h, s, l }: Hsl): string {
  const r = (n: number, p = 2): number => Number(n.toFixed(p));
  return `${String(r(h))} ${String(r(s))}% ${String(r(l))}%`;
}

export function hexToHsl(hex: string): Hsl {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  if (!/^[\da-fA-F]{6}$/.test(full)) throw new Error(`Invalid hex: ${hex}`);
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h *= 60;
  }
  return { h, s: s * 100, l: l * 100 };
}

export function hslToHex({ h, s, l }: Hsl): string {
  const sN = s / 100;
  const lN = l / 100;
  const c = (1 - Math.abs(2 * lN - 1)) * sN;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lN - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const to = (v: number): string =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

export function hslToRgb({ h, s, l }: Hsl): { r: number; g: number; b: number } {
  const sN = s / 100;
  const lN = l / 100;
  const c = (1 - Math.abs(2 * lN - 1)) * sN;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lN - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}

function relLum({ r, g, b }: { r: number; g: number; b: number }): number {
  const ch = (c: number): number => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

export function contrastRatio(a: Hsl, b: Hsl): number {
  const la = relLum(hslToRgb(a));
  const lb = relLum(hslToRgb(b));
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export type WcagLevel = 'AAA' | 'AA' | 'AA-large' | 'fail';

export function wcagLevel(ratio: number): WcagLevel {
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  if (ratio >= 3) return 'AA-large';
  return 'fail';
}

const SCALE_LIGHTNESS: Record<string, number> = {
  '50': 97,
  '100': 93,
  '200': 86,
  '300': 76,
  '400': 64,
  '500': 50,
  '600': 42,
  '700': 34,
  '800': 26,
  '900': 18,
};

export function generateScale(base: Hsl): Record<string, Hsl> {
  const scale: Record<string, Hsl> = {};
  const baseChromaCurve = (l: number): number => {
    const dist = Math.abs(l - 50) / 50;
    return Math.max(8, base.s * (1 - dist * 0.45));
  };
  for (const step of SCALE_STEPS) {
    const targetL = SCALE_LIGHTNESS[step] ?? 50;
    scale[step] = { h: base.h, s: baseChromaCurve(targetL), l: targetL };
  }
  return scale;
}

export interface CvdMode {
  name: 'normal' | 'protanopia' | 'deuteranopia' | 'tritanopia';
  matrix: [number, number, number, number, number, number, number, number, number] | null;
}

const CVD_MATRICES: Record<Exclude<CvdMode['name'], 'normal'>, CvdMode['matrix']> = {
  protanopia: [0.567, 0.433, 0.0, 0.558, 0.442, 0.0, 0.0, 0.242, 0.758],
  deuteranopia: [0.625, 0.375, 0.0, 0.7, 0.3, 0.0, 0.0, 0.3, 0.7],
  tritanopia: [0.95, 0.05, 0.0, 0.0, 0.433, 0.567, 0.0, 0.475, 0.525],
};

export function simulateCvd(hsl: Hsl, mode: CvdMode['name']): Hsl {
  if (mode === 'normal') return hsl;
  const m = CVD_MATRICES[mode];
  if (!m) return hsl;
  const { r, g, b } = hslToRgb(hsl);
  const [r1, g1, b1] = [
    m[0] * r + m[1] * g + m[2] * b,
    m[3] * r + m[4] * g + m[5] * b,
    m[6] * r + m[7] * g + m[8] * b,
  ];
  const hex = `#${[r1, g1, b1]
    .map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0'))
    .join('')}`;
  return hexToHsl(hex);
}

export function nudgeForContrast(target: Hsl, against: Hsl, minRatio = 4.5): Hsl {
  if (contrastRatio(target, against) >= minRatio) return target;
  const stepDir = against.l > 50 ? -1 : 1;
  let l = target.l;
  for (let i = 0; i < 100; i++) {
    l = Math.max(0, Math.min(100, l + stepDir * 2));
    const candidate = { ...target, l };
    if (contrastRatio(candidate, against) >= minRatio) return candidate;
    if (l <= 0 || l >= 100) break;
  }
  return { ...target, l };
}
