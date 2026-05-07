import { z } from 'zod';
import { definePrompt, registerPrompt } from '../registry.js';

const inputs = z.object({
  projectType: z.string(),
  vibeDescriptors: z.array(z.string()),
  brandFontFamily: z.string().optional(),
});

const scaleItemSchema = z.object({ fontSize: z.string(), lineHeight: z.string(), letterSpacing: z.string().optional() });

const outputs = z.object({
  fontFamilyBase: z.string(),
  fontFamilyMono: z.string(),
  fontFamilyDisplay: z.string().optional(),
  fontWeightNormal: z.number(),
  fontWeightMedium: z.number(),
  fontWeightSemibold: z.number(),
  fontWeightBold: z.number(),
  scale: z.object({
    xs: scaleItemSchema, sm: scaleItemSchema, base: scaleItemSchema, lg: scaleItemSchema,
    xl: scaleItemSchema, '2xl': scaleItemSchema, '3xl': scaleItemSchema, '4xl': scaleItemSchema,
  }),
  reasoning: z.string(),
});

export const typographyPrompt = definePrompt({
  id: 'design-tokens.typography',
  version: '1.0.0',
  description: 'Generate typography tokens (families, scale, weights)',
  inputs,
  outputs,
  modelConfig: { model: 'claude-opus-4-7', maxTokens: 2048, temperature: 0.3 },
  systemPrompt: `You are a typography expert. Choose system font stacks by default (no auto-bundled web fonts). Use rem units for font sizes. Generate a harmonious 8-step modular scale. Weights must be standard (400, 500, 600, 700).`,

  userPromptTemplate: `Project type: {{projectType}}
Vibe descriptors: {{vibeDescriptors}}
{{#if brandFontFamily}}Preferred font: {{brandFontFamily}}{{/if}}

Generate typography tokens including font families (system stacks), weights, and an 8-step scale from xs to 4xl. Provide reasoning.`,

  tests: [
    {
      name: 'generates valid typography tokens',
      input: { projectType: 'CRM', vibeDescriptors: ['professional'] },
      assertions: [
        (output: z.infer<typeof outputs>) => output.fontFamilyBase.length > 0,
        (output: z.infer<typeof outputs>) => output.scale.base.fontSize.endsWith('rem'),
        (output: z.infer<typeof outputs>) => output.fontWeightBold === 700,
      ],
    },
  ],
});

registerPrompt(typographyPrompt);
