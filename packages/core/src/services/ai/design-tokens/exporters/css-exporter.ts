import type { DesignTokenSet } from '../types.js';

export class CssExporter {
  export(tokenSet: DesignTokenSet): { content: string; filename: string } {
    const lines: string[] = [':root {'];

    // Color scales
    for (const palette of ['primary', 'secondary', 'success', 'warning', 'danger', 'info', 'neutral'] as const) {
      const scale = tokenSet.colors[palette];
      for (const shade of ['50','100','200','300','400','500','600','700','800','900'] as const) {
        lines.push(`  --color-${palette}-${shade}: ${scale[shade]};`);
      }
    }

    // Light theme surfaces
    for (const [key, val] of Object.entries(tokenSet.colors.light)) {
      lines.push(`  --color-light-${toKebab(key)}: ${val};`);
    }

    // Dark theme surfaces (in a separate selector)
    lines.push('');
    lines.push('  /* Dark theme — apply .dark to <html> */');
    for (const [key, val] of Object.entries(tokenSet.colors.dark)) {
      lines.push(`  --color-dark-${toKebab(key)}: ${val};`);
    }

    // Typography
    lines.push('');
    const t = tokenSet.typography;
    lines.push(`  --font-base: ${t.fontFamilyBase};`);
    lines.push(`  --font-mono: ${t.fontFamilyMono};`);
    if (t.fontFamilyDisplay) lines.push(`  --font-display: ${t.fontFamilyDisplay};`);
    lines.push(`  --font-weight-normal: ${t.fontWeightNormal};`);
    lines.push(`  --font-weight-medium: ${t.fontWeightMedium};`);
    lines.push(`  --font-weight-semibold: ${t.fontWeightSemibold};`);
    lines.push(`  --font-weight-bold: ${t.fontWeightBold};`);
    for (const [step, val] of Object.entries(t.scale)) {
      lines.push(`  --text-${step}: ${(val as { fontSize: string }).fontSize};`);
      lines.push(`  --leading-${step}: ${(val as { lineHeight: string }).lineHeight};`);
    }

    // Spacing
    lines.push('');
    for (const [k, v] of Object.entries(tokenSet.spacing)) {
      lines.push(`  --spacing-${k}: ${v};`);
    }

    // Sizing
    for (const [k, v] of Object.entries(tokenSet.sizing)) {
      lines.push(`  --size-${toKebab(k)}: ${v};`);
    }

    // Border radius
    for (const [k, v] of Object.entries(tokenSet.borderRadius)) {
      lines.push(`  --radius-${k}: ${v};`);
    }

    // Shadows
    for (const [k, v] of Object.entries(tokenSet.shadows)) {
      lines.push(`  --shadow-${k}: ${v};`);
    }

    // Motion
    const m = tokenSet.motion;
    lines.push(`  --duration-fast: ${m.durationFast};`);
    lines.push(`  --duration-base: ${m.durationBase};`);
    lines.push(`  --duration-slow: ${m.durationSlow};`);
    lines.push(`  --easing-default: ${m.easingDefault};`);
    lines.push(`  --easing-in: ${m.easingIn};`);
    lines.push(`  --easing-out: ${m.easingOut};`);
    lines.push(`  --easing-bounce: ${m.easingBounce};`);

    // Z-index
    for (const [k, v] of Object.entries(tokenSet.zIndex)) {
      lines.push(`  --z-${k}: ${v};`);
    }

    // Breakpoints
    for (const [k, v] of Object.entries(tokenSet.breakpoints)) {
      lines.push(`  --screen-${k}: ${v};`);
    }

    lines.push('}');

    // Dark mode class overrides
    lines.push('');
    lines.push('.dark {');
    for (const [key, val] of Object.entries(tokenSet.colors.dark)) {
      lines.push(`  --color-${toKebab(key)}: ${val};`);
    }
    lines.push('}');

    return { content: lines.join('\n'), filename: 'tokens.css' };
  }
}

function toKebab(str: string): string {
  return str.replace(/([A-Z])/g, (m) => `-${m.toLowerCase()}`);
}
