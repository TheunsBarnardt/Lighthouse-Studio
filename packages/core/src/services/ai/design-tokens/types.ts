import { z } from 'zod';

// ── Brand inputs ─────────────────────────────────────────────────────────────

export const BrandColorSchema = z.object({
  name: z.string(),
  hex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  locked: z.boolean().default(false),
});
export type BrandColor = z.infer<typeof BrandColorSchema>;

export const BrandInputsSchema = z.object({
  logoFileId: z.string().optional(),
  brandColors: z.array(BrandColorSchema).optional(),
  vibeDescriptors: z.array(z.string()).min(1),
  referenceUrls: z.array(z.string().url()).max(3).optional(),
});
export type BrandInputs = z.infer<typeof BrandInputsSchema>;

// ── Token value types ────────────────────────────────────────────────────────

export type ColorValue = { hex: string; oklch: string };

export const ColorScaleSchema = z.object({
  '50': z.string(),
  '100': z.string(),
  '200': z.string(),
  '300': z.string(),
  '400': z.string(),
  '500': z.string(),
  '600': z.string(),
  '700': z.string(),
  '800': z.string(),
  '900': z.string(),
});
export type ColorScale = z.infer<typeof ColorScaleSchema>;

export const ColorTokensSchema = z.object({
  // Semantic palettes
  primary: ColorScaleSchema,
  secondary: ColorScaleSchema,
  success: ColorScaleSchema,
  warning: ColorScaleSchema,
  danger: ColorScaleSchema,
  info: ColorScaleSchema,
  neutral: ColorScaleSchema,

  // Semantic surfaces — light theme
  light: z.object({
    surfaceBase: z.string(),
    surfaceElevated: z.string(),
    surfaceOverlay: z.string(),
    contentPrimary: z.string(),
    contentSecondary: z.string(),
    contentDisabled: z.string(),
    borderDefault: z.string(),
    borderFocus: z.string(),
  }),

  // Semantic surfaces — dark theme
  dark: z.object({
    surfaceBase: z.string(),
    surfaceElevated: z.string(),
    surfaceOverlay: z.string(),
    contentPrimary: z.string(),
    contentSecondary: z.string(),
    contentDisabled: z.string(),
    borderDefault: z.string(),
    borderFocus: z.string(),
  }),
});
export type ColorTokens = z.infer<typeof ColorTokensSchema>;

export const TypographyScaleItemSchema = z.object({
  fontSize: z.string(), // rem
  lineHeight: z.string(),
  letterSpacing: z.string().optional(),
});

export const TypographyTokensSchema = z.object({
  fontFamilyBase: z.string(), // CSS font-family stack
  fontFamilyMono: z.string(),
  fontFamilyDisplay: z.string().optional(),
  fontWeightNormal: z.number(),
  fontWeightMedium: z.number(),
  fontWeightSemibold: z.number(),
  fontWeightBold: z.number(),
  scale: z.object({
    xs: TypographyScaleItemSchema,
    sm: TypographyScaleItemSchema,
    base: TypographyScaleItemSchema,
    lg: TypographyScaleItemSchema,
    xl: TypographyScaleItemSchema,
    '2xl': TypographyScaleItemSchema,
    '3xl': TypographyScaleItemSchema,
    '4xl': TypographyScaleItemSchema,
  }),
});
export type TypographyTokens = z.infer<typeof TypographyTokensSchema>;

export const SpacingTokensSchema = z.object({
  '0': z.string(),
  '1': z.string(),
  '2': z.string(),
  '3': z.string(),
  '4': z.string(),
  '5': z.string(),
  '6': z.string(),
  '8': z.string(),
  '10': z.string(),
  '12': z.string(),
  '16': z.string(),
  '20': z.string(),
  '24': z.string(),
});
export type SpacingTokens = z.infer<typeof SpacingTokensSchema>;

export const SizingTokensSchema = z.object({
  iconXs: z.string(),
  iconSm: z.string(),
  iconMd: z.string(),
  iconLg: z.string(),
  iconXl: z.string(),
  avatarSm: z.string(),
  avatarMd: z.string(),
  avatarLg: z.string(),
  containerSm: z.string(),
  containerMd: z.string(),
  containerLg: z.string(),
  containerXl: z.string(),
});
export type SizingTokens = z.infer<typeof SizingTokensSchema>;

export const BorderRadiusTokensSchema = z.object({
  none: z.string(),
  sm: z.string(),
  base: z.string(),
  md: z.string(),
  lg: z.string(),
  xl: z.string(),
  '2xl': z.string(),
  full: z.string(),
});
export type BorderRadiusTokens = z.infer<typeof BorderRadiusTokensSchema>;

export const ShadowTokensSchema = z.object({
  none: z.string(),
  sm: z.string(),
  base: z.string(),
  md: z.string(),
  lg: z.string(),
  xl: z.string(),
  inner: z.string(),
});
export type ShadowTokens = z.infer<typeof ShadowTokensSchema>;

export const MotionTokensSchema = z.object({
  durationFast: z.string(),   // e.g. '100ms'
  durationBase: z.string(),   // e.g. '200ms'
  durationSlow: z.string(),   // e.g. '400ms'
  easingDefault: z.string(),  // CSS easing function
  easingIn: z.string(),
  easingOut: z.string(),
  easingBounce: z.string(),
});
export type MotionTokens = z.infer<typeof MotionTokensSchema>;

export const ZIndexTokensSchema = z.object({
  base: z.number(),
  dropdown: z.number(),
  sticky: z.number(),
  modal: z.number(),
  popover: z.number(),
  toast: z.number(),
  tooltip: z.number(),
});
export type ZIndexTokens = z.infer<typeof ZIndexTokensSchema>;

export const BreakpointTokensSchema = z.object({
  sm: z.string(),
  md: z.string(),
  lg: z.string(),
  xl: z.string(),
  '2xl': z.string(),
});
export type BreakpointTokens = z.infer<typeof BreakpointTokensSchema>;

// ── Accessibility report ─────────────────────────────────────────────────────

export interface ContrastResult {
  foreground: string;
  background: string;
  ratio: number;
  wcagAaPass: boolean;
  wcagAaaPass: boolean;
}

export interface AccessibilityReport {
  passCount: number;
  failCount: number;
  results: ContrastResult[];
  overallPass: boolean;
  checkedAt: Date;
}

// ── Consistency report ───────────────────────────────────────────────────────

export interface ConsistencyIssue {
  category: string;
  description: string;
  severity: 'error' | 'warning';
}

export interface DesignConsistencyReport {
  issues: ConsistencyIssue[];
  checkedAt: Date;
}

// ── Full token set ───────────────────────────────────────────────────────────

export const DesignTokenSetSchema = z.object({
  prdArtifactId: z.string(),
  brandInputs: BrandInputsSchema,
  colors: ColorTokensSchema,
  typography: TypographyTokensSchema,
  spacing: SpacingTokensSchema,
  sizing: SizingTokensSchema,
  borderRadius: BorderRadiusTokensSchema,
  shadows: ShadowTokensSchema,
  motion: MotionTokensSchema,
  zIndex: ZIndexTokensSchema,
  breakpoints: BreakpointTokensSchema,
});
export type DesignTokenSet = z.infer<typeof DesignTokenSetSchema>;

// ── Token categories ─────────────────────────────────────────────────────────

export const TOKEN_CATEGORIES = [
  'colors',
  'typography',
  'spacing',
  'sizing',
  'borderRadius',
  'shadows',
  'motion',
  'zIndex',
  'breakpoints',
] as const;

export type TokenCategory = (typeof TOKEN_CATEGORIES)[number];

// ── Service inputs ───────────────────────────────────────────────────────────

export interface GenerateTokensInput {
  prdArtifactId: string;
  brandInputs: BrandInputs;
}

export type ExportFormat = 'css' | 'tailwind' | 'json_dtcg' | 'typescript';
