import type { AccessibilityReport, ContrastResult, DesignTokenSet } from './types.js';

/** Compute relative luminance per WCAG 2.2. */
function relativeLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const linearize = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/** Compute WCAG contrast ratio between two hex colors. */
export function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function validateContrast(foreground: string, background: string): ContrastResult {
  const ratio = contrastRatio(foreground, background);
  return {
    foreground,
    background,
    ratio: Math.round(ratio * 100) / 100,
    wcagAaPass: ratio >= 4.5,
    wcagAaaPass: ratio >= 7.0,
  };
}

/** Validate all critical text/background pairings in a full token set. */
export function validateTokenSetAccessibility(set: DesignTokenSet): AccessibilityReport {
  const results: ContrastResult[] = [];

  // Light theme — body text on surface
  results.push(validateContrast(set.colors.light.contentPrimary, set.colors.light.surfaceBase));
  results.push(validateContrast(set.colors.light.contentSecondary, set.colors.light.surfaceBase));

  // Dark theme — body text on surface
  results.push(validateContrast(set.colors.dark.contentPrimary, set.colors.dark.surfaceBase));
  results.push(validateContrast(set.colors.dark.contentSecondary, set.colors.dark.surfaceBase));

  // Primary 600 on white (typical button text background check)
  const primary600 = set.colors.primary['600'];
  results.push(validateContrast('#ffffff', primary600));
  results.push(validateContrast(primary600, '#ffffff'));

  const passCount = results.filter((r) => r.wcagAaPass).length;
  const failCount = results.length - passCount;

  return {
    passCount,
    failCount,
    results,
    overallPass: failCount === 0,
    checkedAt: new Date(),
  };
}
