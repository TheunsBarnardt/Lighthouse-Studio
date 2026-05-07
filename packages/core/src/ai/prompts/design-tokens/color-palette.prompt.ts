import { z } from 'zod';
import { definePrompt, registerPrompt } from '../registry.js';

const inputs = z.object({
  projectType: z.string(),
  targetUsers: z.string(),
  vibeDescriptors: z.array(z.string()),
  brandColors: z.array(z.object({ name: z.string(), hex: z.string(), locked: z.boolean() })).optional(),
  referenceUrls: z.array(z.string()).optional(),
});

const scaleSchema = z.object({
  '50': z.string(), '100': z.string(), '200': z.string(), '300': z.string(),
  '400': z.string(), '500': z.string(), '600': z.string(), '700': z.string(),
  '800': z.string(), '900': z.string(),
});

const outputs = z.object({
  primary: scaleSchema,
  secondary: scaleSchema,
  success: scaleSchema,
  warning: scaleSchema,
  danger: scaleSchema,
  info: scaleSchema,
  neutral: scaleSchema,
  light: z.object({
    surfaceBase: z.string(), surfaceElevated: z.string(), surfaceOverlay: z.string(),
    contentPrimary: z.string(), contentSecondary: z.string(), contentDisabled: z.string(),
    borderDefault: z.string(), borderFocus: z.string(),
  }),
  dark: z.object({
    surfaceBase: z.string(), surfaceElevated: z.string(), surfaceOverlay: z.string(),
    contentPrimary: z.string(), contentSecondary: z.string(), contentDisabled: z.string(),
    borderDefault: z.string(), borderFocus: z.string(),
  }),
  reasoning: z.string(),
});

export const colorPalettePrompt = definePrompt({
  id: 'design-tokens.color-palette',
  version: '1.0.0',
  description: 'Generate semantic color palettes with light + dark theme surfaces',
  inputs,
  outputs,
  modelConfig: { model: 'claude-opus-4-7', maxTokens: 4096, temperature: 0.3 },
  systemPrompt: `You are a visual design expert specialising in accessible color systems. You generate color palettes using OKLCH principles (perceptually uniform). Output all colors as 6-digit hex strings. WCAG AA contrast is mandatory; AAA preferred.

Generate light + dark themes together. Light: surfaces at 95-100% lightness; dark: surfaces at 5-15% lightness. Both must pass WCAG AA for text on surface.

Locked brand colors must appear exactly as specified in the primary scale at shade 500.`,

  userPromptTemplate: `Project type: {{projectType}}
Target users: {{targetUsers}}
Vibe descriptors: {{vibeDescriptors}}
{{#if brandColors}}Brand colors: {{brandColors}}{{/if}}
{{#if referenceUrls}}Reference inspiration: {{referenceUrls}}{{/if}}

Generate a complete color token set with 9-step scales (50-900) for all semantic colors and semantic surface/content tokens for both light and dark themes. Provide reasoning.`,

  tests: [
    {
      name: 'generates valid color scales',
      input: {
        projectType: 'CRM', targetUsers: 'Sales teams',
        vibeDescriptors: ['professional', 'trustworthy'], brandColors: [],
      },
      assertions: [
        (output: z.infer<typeof outputs>) => Object.keys(output.primary).length === 10,
        (output: z.infer<typeof outputs>) => output.primary['500'].startsWith('#'),
        (output: z.infer<typeof outputs>) => output.light.surfaceBase.startsWith('#'),
        (output: z.infer<typeof outputs>) => output.dark.surfaceBase.startsWith('#'),
        (output: z.infer<typeof outputs>) => output.reasoning.length > 50,
      ],
    },
  ],
});

registerPrompt(colorPalettePrompt);
