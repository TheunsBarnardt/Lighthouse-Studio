import { z } from 'zod';
import { definePrompt, registerPrompt } from '../registry.js';

const inputs = z.object({
  failingPairs: z.array(z.object({
    foreground: z.string(), background: z.string(),
    ratio: z.number(), context: z.string(),
  })),
  primaryScale: z.record(z.string()),
  vibeDescriptors: z.array(z.string()),
});

const outputs = z.object({
  adjustments: z.array(z.object({
    foreground: z.string().optional(),
    background: z.string().optional(),
    suggestedForeground: z.string().optional(),
    suggestedBackground: z.string().optional(),
    expectedRatio: z.number(),
    explanation: z.string(),
  })),
  reasoning: z.string(),
});

export const accessibilityValidationPrompt = definePrompt({
  id: 'design-tokens.accessibility-validation',
  version: '1.0.0',
  description: 'Suggest color adjustments to pass WCAG AA contrast requirements',
  inputs,
  outputs,
  modelConfig: { model: 'claude-opus-4-7', maxTokens: 2048, temperature: 0.2 },
  systemPrompt: `You are an accessibility expert. For each failing contrast pair (ratio < 4.5), suggest minimal adjustments to the foreground or background color to achieve WCAG AA compliance (≥ 4.5:1 ratio). Preserve the brand identity; adjust lightness first, then chroma. Explain each adjustment.`,
  userPromptTemplate: `Failing contrast pairs: {{failingPairs}}. Primary color scale: {{primaryScale}}. Vibe: {{vibeDescriptors}}. Suggest adjustments.`,
  tests: [
    {
      name: 'suggests adjustments for failing pairs',
      input: {
        failingPairs: [{ foreground: '#888888', background: '#ffffff', ratio: 3.5, context: 'body text' }],
        primaryScale: { '500': '#3b82f6' },
        vibeDescriptors: ['professional'],
      },
      assertions: [
        (output: z.infer<typeof outputs>) => output.adjustments.length >= 1,
        (output: z.infer<typeof outputs>) => output.adjustments[0].expectedRatio >= 4.5,
      ],
    },
  ],
});

registerPrompt(accessibilityValidationPrompt);
