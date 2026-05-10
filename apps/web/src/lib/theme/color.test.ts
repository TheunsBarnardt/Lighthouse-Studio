import { describe, expect, it } from 'vitest';

import {
  contrastRatio,
  formatHslTuple,
  generateScale,
  hexToHsl,
  hslToHex,
  nudgeForContrast,
  parseHslTuple,
  simulateCvd,
  wcagLevel,
} from './color';

describe('hex/hsl conversion', () => {
  it('round-trips primary blue', () => {
    const hex = '#2563eb';
    const hsl = hexToHsl(hex);
    expect(hsl.h).toBeCloseTo(221.2, 0);
    const back = hslToHex(hsl);
    expect(back.toLowerCase()).toBe(hex);
  });

  it('parses and formats tuples', () => {
    const tuple = '220 90% 56%';
    const parsed = parseHslTuple(tuple);
    expect(parsed.h).toBe(220);
    expect(parsed.s).toBe(90);
    expect(parsed.l).toBe(56);
    expect(formatHslTuple(parsed)).toBe('220 90% 56%');
  });

  it('rejects malformed tuples', () => {
    expect(() => parseHslTuple('rgb(1,2,3)')).toThrow();
  });
});

describe('contrast', () => {
  it('white on black is maximum', () => {
    const ratio = contrastRatio({ h: 0, s: 0, l: 100 }, { h: 0, s: 0, l: 0 });
    expect(ratio).toBeCloseTo(21, 0);
    expect(wcagLevel(ratio)).toBe('AAA');
  });

  it('flags low contrast as fail', () => {
    const ratio = contrastRatio({ h: 0, s: 0, l: 60 }, { h: 0, s: 0, l: 50 });
    expect(wcagLevel(ratio)).toBe('fail');
  });

  it('nudges toward passing', () => {
    const target = { h: 220, s: 90, l: 60 };
    const against = { h: 0, s: 0, l: 100 };
    const nudged = nudgeForContrast(target, against, 4.5);
    expect(contrastRatio(nudged, against)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('scale generation', () => {
  it('produces 10 steps with monotonically decreasing lightness', () => {
    const scale = generateScale({ h: 220, s: 80, l: 50 });
    const lightness = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900'].map(
      (k) => scale[k]!.l,
    );
    expect(lightness).toHaveLength(10);
    for (let i = 1; i < lightness.length; i++) {
      expect(lightness[i]).toBeLessThan(lightness[i - 1]!);
    }
  });
});

describe('cvd simulation', () => {
  it('returns input on normal mode', () => {
    const c = { h: 30, s: 80, l: 50 };
    expect(simulateCvd(c, 'normal')).toEqual(c);
  });

  it('shifts color in deuteranopia', () => {
    const c = { h: 30, s: 80, l: 50 };
    const out = simulateCvd(c, 'deuteranopia');
    expect(out).not.toEqual(c);
  });
});
