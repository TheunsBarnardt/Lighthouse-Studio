import { z } from 'zod';

export const HslTuple = z
  .string()
  .regex(/^\d{1,3}(\.\d+)?\s+\d{1,3}(\.\d+)?%\s+\d{1,3}(\.\d+)?%$/, 'Expected "H S% L%"');

export const TokenRefSchema = z.union([
  z.object({ ref: z.string().min(1) }),
  z.object({ value: z.string().min(1) }),
]);
export type TokenRef = z.infer<typeof TokenRefSchema>;

export const ColorScaleSchema = z.object({
  base: HslTuple,
  steps: z.record(z.string(), HslTuple),
  manual: z.record(z.string(), z.boolean()).optional(),
});
export type ColorScale = z.infer<typeof ColorScaleSchema>;

export const PrimitivesSchema = z.object({
  colors: z.record(z.string(), ColorScaleSchema),
  spacing: z.record(z.string(), z.string()),
  fontSize: z.record(z.string(), z.string()),
  radius: z.record(z.string(), z.string()),
  shadow: z.record(z.string(), z.string()),
});
export type Primitives = z.infer<typeof PrimitivesSchema>;

export const ModeSemanticsSchema = z.record(z.string(), TokenRefSchema);
export type ModeSemantics = z.infer<typeof ModeSemanticsSchema>;

export const FontsSchema = z.object({
  sans: z.string(),
  serif: z.string().optional(),
  mono: z.string(),
  display: z.string().optional(),
});
export type Fonts = z.infer<typeof FontsSchema>;

export const WorkspaceThemeSchema = z.object({
  version: z.number().int().nonnegative(),
  source: z.enum(['preset', 'custom']),
  presetId: z.string().optional(),
  primitives: PrimitivesSchema,
  semantics: z.object({
    light: ModeSemanticsSchema,
    dark: ModeSemanticsSchema,
  }),
  fonts: FontsSchema,
  radiusBase: z.string(),
  updatedAt: z.string(),
  updatedBy: z.string(),
});
export type WorkspaceTheme = z.infer<typeof WorkspaceThemeSchema>;

export const SEMANTIC_KEYS = [
  'background',
  'foreground',
  'card',
  'card-foreground',
  'primary',
  'primary-foreground',
  'secondary',
  'secondary-foreground',
  'muted',
  'muted-foreground',
  'accent',
  'accent-foreground',
  'destructive',
  'destructive-foreground',
  'border',
  'input',
  'ring',
  'success',
  'warning',
  'error',
  'info',
] as const;
export type SemanticKey = (typeof SEMANTIC_KEYS)[number];

export const SCALE_STEPS = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900'] as const;
export type ScaleStep = (typeof SCALE_STEPS)[number];
