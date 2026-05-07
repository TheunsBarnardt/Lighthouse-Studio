/**
 * Lightweight OKLCH ↔ hex conversion utilities.
 *
 * OKLCH is a perceptually uniform color space (L=lightness, C=chroma, H=hue).
 * Using it to generate color scales ensures even perceptual steps between shades
 * without the muddy mid-tones that occur with RGB lightening/darkening.
 *
 * Production: replace with the `culori` library for full color-space support.
 * This implementation covers the core scale-generation use case.
 */

export interface OklchColor {
  l: number; // 0-1
  c: number; // 0-0.4 typically
  h: number; // 0-360
}

/** Convert hex color to approximate OKLCH. Simplified for scale generation. */
export function hexToOklch(hex: string): OklchColor {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  // Linearize sRGB
  const lr = r <= 0.04045 ? r / 12.92 : ((r + 0.055) / 1.055) ** 2.4;
  const lg = g <= 0.04045 ? g / 12.92 : ((g + 0.055) / 1.055) ** 2.4;
  const lb = b <= 0.04045 ? b / 12.92 : ((b + 0.055) / 1.055) ** 2.4;

  // Linear sRGB → OKLab (simplified)
  const lms_l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const lms_m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const lms_s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;

  const l_ = Math.cbrt(lms_l);
  const m_ = Math.cbrt(lms_m);
  const s_ = Math.cbrt(lms_s);

  const L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
  const bv = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;

  const C = Math.sqrt(a * a + bv * bv);
  const H = ((Math.atan2(bv, a) * 180) / Math.PI + 360) % 360;

  return { l: L, c: C, h: H };
}

/** Convert OKLCH to hex. */
export function oklchToHex(color: OklchColor): string {
  const { l, c, h } = color;
  const hRad = (h * Math.PI) / 180;
  const a = c * Math.cos(hRad);
  const bv = c * Math.sin(hRad);

  // OKLab → LMS
  const l_ = l + 0.3963377774 * a + 0.2158037573 * bv;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * bv;
  const s_ = l - 0.0894841775 * a - 1.2914855480 * bv;

  const lms_l = l_ * l_ * l_;
  const lms_m = m_ * m_ * m_;
  const lms_s = s_ * s_ * s_;

  // LMS → linear sRGB
  let r = +4.0767416621 * lms_l - 3.3077115913 * lms_m + 0.2309699292 * lms_s;
  let g = -1.2684380046 * lms_l + 2.6097574011 * lms_m - 0.3413193965 * lms_s;
  let bVal = -0.0041960863 * lms_l - 0.7034186147 * lms_m + 1.7076147010 * lms_s;

  // Clamp
  r = Math.max(0, Math.min(1, r));
  g = Math.max(0, Math.min(1, g));
  bVal = Math.max(0, Math.min(1, bVal));

  // Linearize → sRGB
  const to8Bit = (v: number) => {
    const srgb = v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
    return Math.round(Math.max(0, Math.min(1, srgb)) * 255);
  };

  return `#${to8Bit(r).toString(16).padStart(2, '0')}${to8Bit(g).toString(16).padStart(2, '0')}${to8Bit(bVal).toString(16).padStart(2, '0')}`;
}

/** Generate a 9-step perceptually uniform color scale from a base hex color. */
export function generateColorScale(baseHex: string): Record<string, string> {
  const base = hexToOklch(baseHex);
  const lightnessStops = [0.97, 0.93, 0.85, 0.75, 0.65, 0.55, 0.44, 0.35, 0.25];
  const labels = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900'];

  const scale: Record<string, string> = {};
  lightnessStops.forEach((l, i) => {
    // Adjust chroma: very light and very dark shades get reduced chroma
    const chromaFactor = 1 - Math.abs(l - 0.55) * 0.5;
    const hex = oklchToHex({ l, c: base.c * chromaFactor, h: base.h });
    scale[labels[i]] = hex;
  });
  // 500 is the base color itself
  scale['500'] = baseHex;

  return scale as Record<string, string>;
}

/** Format an OKLCH color as a CSS oklch() string. */
export function oklchToCss(color: OklchColor): string {
  return `oklch(${(color.l * 100).toFixed(1)}% ${color.c.toFixed(3)} ${color.h.toFixed(1)})`;
}
