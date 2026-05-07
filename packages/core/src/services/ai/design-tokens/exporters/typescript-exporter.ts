import type { DesignTokenSet } from '../types.js';

export class TypeScriptExporter {
  export(tokenSet: DesignTokenSet): { content: string; filename: string } {
    const lines: string[] = [
      '// Auto-generated design tokens — do not edit manually',
      '',
      'export const colors = {',
    ];

    for (const palette of ['primary', 'secondary', 'success', 'warning', 'danger', 'info', 'neutral'] as const) {
      lines.push(`  ${palette}: {`);
      const scale = tokenSet.colors[palette];
      for (const shade of ['50','100','200','300','400','500','600','700','800','900'] as const) {
        lines.push(`    '${shade}': '${scale[shade]}',`);
      }
      lines.push('  },');
    }

    lines.push('  light: {');
    for (const [k, v] of Object.entries(tokenSet.colors.light)) {
      lines.push(`    ${k}: '${v}',`);
    }
    lines.push('  },');

    lines.push('  dark: {');
    for (const [k, v] of Object.entries(tokenSet.colors.dark)) {
      lines.push(`    ${k}: '${v}',`);
    }
    lines.push('  },');
    lines.push('} as const;');
    lines.push('');

    lines.push('export const typography = {');
    const t = tokenSet.typography;
    lines.push(`  fontFamilyBase: '${t.fontFamilyBase}',`);
    lines.push(`  fontFamilyMono: '${t.fontFamilyMono}',`);
    if (t.fontFamilyDisplay) lines.push(`  fontFamilyDisplay: '${t.fontFamilyDisplay}',`);
    lines.push(`  fontWeightNormal: ${t.fontWeightNormal},`);
    lines.push(`  fontWeightMedium: ${t.fontWeightMedium},`);
    lines.push(`  fontWeightSemibold: ${t.fontWeightSemibold},`);
    lines.push(`  fontWeightBold: ${t.fontWeightBold},`);
    lines.push('  scale: {');
    for (const [step, val] of Object.entries(t.scale)) {
      const v = val as { fontSize: string; lineHeight: string };
      lines.push(`    ${step}: { fontSize: '${v.fontSize}', lineHeight: '${v.lineHeight}' },`);
    }
    lines.push('  },');
    lines.push('} as const;');
    lines.push('');

    lines.push('export const spacing = {');
    for (const [k, v] of Object.entries(tokenSet.spacing)) {
      lines.push(`  '${k}': '${v}',`);
    }
    lines.push('} as const;');
    lines.push('');

    lines.push('export const borderRadius = {');
    for (const [k, v] of Object.entries(tokenSet.borderRadius)) {
      lines.push(`  ${k}: '${v}',`);
    }
    lines.push('} as const;');
    lines.push('');

    lines.push('export const shadows = {');
    for (const [k, v] of Object.entries(tokenSet.shadows)) {
      lines.push(`  ${k}: '${v}',`);
    }
    lines.push('} as const;');
    lines.push('');

    lines.push('export const motion = {');
    lines.push(`  durationFast: '${tokenSet.motion.durationFast}',`);
    lines.push(`  durationBase: '${tokenSet.motion.durationBase}',`);
    lines.push(`  durationSlow: '${tokenSet.motion.durationSlow}',`);
    lines.push(`  easingDefault: '${tokenSet.motion.easingDefault}',`);
    lines.push(`  easingIn: '${tokenSet.motion.easingIn}',`);
    lines.push(`  easingOut: '${tokenSet.motion.easingOut}',`);
    lines.push(`  easingBounce: '${tokenSet.motion.easingBounce}',`);
    lines.push('} as const;');
    lines.push('');

    lines.push('export const zIndex = {');
    for (const [k, v] of Object.entries(tokenSet.zIndex)) {
      lines.push(`  ${k}: ${v},`);
    }
    lines.push('} as const;');
    lines.push('');

    lines.push('export const breakpoints = {');
    for (const [k, v] of Object.entries(tokenSet.breakpoints)) {
      lines.push(`  ${k}: '${v}',`);
    }
    lines.push('} as const;');

    return { content: lines.join('\n'), filename: 'tokens.ts' };
  }
}
