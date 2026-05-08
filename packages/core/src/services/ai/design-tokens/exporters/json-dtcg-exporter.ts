import type { DesignTokenSet } from '../types.js';

interface DtcgToken {
  $value: unknown;
  $type: string;
  $description?: string;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface DtcgGroup extends Record<string, DtcgToken | DtcgGroup> {}

export class JsonDtcgExporter {
  export(tokenSet: DesignTokenSet): { content: string; filename: string } {
    const root: DtcgGroup = {};

    // Colors
    root['color'] = {} as DtcgGroup;
    const colorGroup = root['color'];

    for (const palette of [
      'primary',
      'secondary',
      'success',
      'warning',
      'danger',
      'info',
      'neutral',
    ] as const) {
      colorGroup[palette] = {} as DtcgGroup;
      const pg = colorGroup[palette];
      const scale = tokenSet.colors[palette];
      for (const shade of [
        '50',
        '100',
        '200',
        '300',
        '400',
        '500',
        '600',
        '700',
        '800',
        '900',
      ] as const) {
        pg[shade] = { $value: scale[shade], $type: 'color' };
      }
    }

    colorGroup['light'] = {};
    const light = colorGroup['light'];
    for (const [k, v] of Object.entries(tokenSet.colors.light)) {
      light[k] = { $value: v, $type: 'color' };
    }

    colorGroup['dark'] = {};
    const dark = colorGroup['dark'];
    for (const [k, v] of Object.entries(tokenSet.colors.dark)) {
      dark[k] = { $value: v, $type: 'color' };
    }

    // Typography
    root['font-family'] = {
      base: { $value: tokenSet.typography.fontFamilyBase, $type: 'fontFamily' },
      mono: { $value: tokenSet.typography.fontFamilyMono, $type: 'fontFamily' },
    };

    root['font-weight'] = {
      normal: { $value: tokenSet.typography.fontWeightNormal, $type: 'fontWeight' },
      medium: { $value: tokenSet.typography.fontWeightMedium, $type: 'fontWeight' },
      semibold: { $value: tokenSet.typography.fontWeightSemibold, $type: 'fontWeight' },
      bold: { $value: tokenSet.typography.fontWeightBold, $type: 'fontWeight' },
    };

    root['font-size'] = {} as DtcgGroup;
    for (const [step, val] of Object.entries(tokenSet.typography.scale)) {
      root['font-size'][step] = {
        $value: (val as { fontSize: string }).fontSize,
        $type: 'dimension',
      };
    }

    // Spacing
    root['spacing'] = {} as DtcgGroup;
    for (const [k, v] of Object.entries(tokenSet.spacing)) {
      root['spacing'][k] = { $value: v, $type: 'dimension' };
    }

    // Border radius
    root['border-radius'] = {} as DtcgGroup;
    for (const [k, v] of Object.entries(tokenSet.borderRadius)) {
      root['border-radius'][k] = { $value: v, $type: 'dimension' };
    }

    // Shadows
    root['shadow'] = {} as DtcgGroup;
    for (const [k, v] of Object.entries(tokenSet.shadows)) {
      root['shadow'][k] = { $value: v, $type: 'shadow' };
    }

    // Motion
    root['duration'] = {
      fast: { $value: tokenSet.motion.durationFast, $type: 'duration' },
      base: { $value: tokenSet.motion.durationBase, $type: 'duration' },
      slow: { $value: tokenSet.motion.durationSlow, $type: 'duration' },
    };
    root['easing'] = {
      default: { $value: tokenSet.motion.easingDefault, $type: 'cubicBezier' },
      in: { $value: tokenSet.motion.easingIn, $type: 'cubicBezier' },
      out: { $value: tokenSet.motion.easingOut, $type: 'cubicBezier' },
      bounce: { $value: tokenSet.motion.easingBounce, $type: 'cubicBezier' },
    };

    // Z-index
    root['z-index'] = {} as DtcgGroup;
    for (const [k, v] of Object.entries(tokenSet.zIndex)) {
      root['z-index'][k] = { $value: v, $type: 'number' };
    }

    // Breakpoints
    root['breakpoint'] = {} as DtcgGroup;
    for (const [k, v] of Object.entries(tokenSet.breakpoints)) {
      root['breakpoint'][k] = { $value: v, $type: 'dimension' };
    }

    return { content: JSON.stringify(root, null, 2), filename: 'tokens.json' };
  }
}
