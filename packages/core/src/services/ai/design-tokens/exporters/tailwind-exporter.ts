import type { DesignTokenSet } from '../types.js';

export class TailwindExporter {
  export(tokenSet: DesignTokenSet): { content: string; filename: string } {
    const colors: Record<string, Record<string, string>> = {};

    for (const palette of ['primary', 'secondary', 'success', 'warning', 'danger', 'info', 'neutral'] as const) {
      colors[palette] = {};
      const scale = tokenSet.colors[palette];
      for (const shade of ['50','100','200','300','400','500','600','700','800','900'] as const) {
        colors[palette][shade] = scale[shade];
      }
    }

    const spacing: Record<string, string> = {};
    for (const [k, v] of Object.entries(tokenSet.spacing)) {
      spacing[k] = v as string;
    }

    const borderRadius: Record<string, string> = {};
    for (const [k, v] of Object.entries(tokenSet.borderRadius)) {
      borderRadius[k === 'base' ? 'DEFAULT' : k] = v as string;
    }

    const boxShadow: Record<string, string> = {};
    for (const [k, v] of Object.entries(tokenSet.shadows)) {
      boxShadow[k === 'base' ? 'DEFAULT' : k] = v as string;
    }

    const t = tokenSet.typography;
    const fontSize: Record<string, [string, { lineHeight: string }]> = {};
    for (const [step, val] of Object.entries(t.scale)) {
      const v = val as { fontSize: string; lineHeight: string };
      fontSize[step] = [v.fontSize, { lineHeight: v.lineHeight }];
    }

    const screens: Record<string, string> = {};
    for (const [k, v] of Object.entries(tokenSet.breakpoints)) {
      screens[k] = v as string;
    }

    const config = {
      theme: {
        extend: {
          colors,
          spacing,
          borderRadius,
          boxShadow,
          fontSize,
          screens,
          fontFamily: {
            sans: [t.fontFamilyBase],
            mono: [t.fontFamilyMono],
            ...(t.fontFamilyDisplay ? { display: [t.fontFamilyDisplay] } : {}),
          },
          fontWeight: {
            normal: String(t.fontWeightNormal),
            medium: String(t.fontWeightMedium),
            semibold: String(t.fontWeightSemibold),
            bold: String(t.fontWeightBold),
          },
          transitionDuration: {
            fast: tokenSet.motion.durationFast,
            DEFAULT: tokenSet.motion.durationBase,
            slow: tokenSet.motion.durationSlow,
          },
          transitionTimingFunction: {
            DEFAULT: tokenSet.motion.easingDefault,
            in: tokenSet.motion.easingIn,
            out: tokenSet.motion.easingOut,
            bounce: tokenSet.motion.easingBounce,
          },
          zIndex: Object.fromEntries(Object.entries(tokenSet.zIndex).map(([k, v]) => [k, String(v)])),
        },
      },
    };

    const content = `/** @type {import('tailwindcss').Config} */
module.exports = ${JSON.stringify(config, null, 2)};
`;
    return { content, filename: 'tailwind.config.js' };
  }
}
