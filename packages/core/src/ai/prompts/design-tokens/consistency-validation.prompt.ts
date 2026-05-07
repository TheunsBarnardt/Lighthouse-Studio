import { z } from 'zod';
import { definePrompt, registerPrompt } from '../registry.js';

const inputs = z.object({
  spacingScale: z.record(z.string()),
  typographyScale: z.record(z.object({ fontSize: z.string(), lineHeight: z.string() })),
  borderRadius: z.record(z.string()),
  shadows: z.record(z.string()),
});

const outputs = z.object({
  issues: z.array(z.object({
    category: z.string(),
    description: z.string(),
    severity: z.enum(['error', 'warning']),
  })),
  overallConsistent: z.boolean(),
  reasoning: z.string(),
});

export const consistencyValidationPrompt = definePrompt({
  id: 'design-tokens.consistency-validation',
  version: '1.0.0',
  description: 'Check cross-category scale alignment in token sets',
  inputs,
  outputs,
  modelConfig: { model: 'claude-haiku-4-5-20251001', maxTokens: 1024, temperature: 0.1 },
  systemPrompt: `Audit design token scales for alignment. Identify mismatches between spacing rhythm, typography leading, and visual hierarchy. Flag as warnings (non-blocking) or errors (blocking). Be pragmatic — some variation is intentional.`,
  userPromptTemplate: `Spacing: {{spacingScale}}. Typography: {{typographyScale}}. Border radius: {{borderRadius}}. Shadows: {{shadows}}. Check consistency.`,
  tests: [
    {
      name: 'returns consistency report',
      input: {
        spacingScale: { '4': '1rem' }, typographyScale: { base: { fontSize: '1rem', lineHeight: '1.5' } },
        borderRadius: { base: '0.25rem' }, shadows: { base: '0 1px 3px rgba(0,0,0,0.1)' },
      },
      assertions: [
        (output: z.infer<typeof outputs>) => typeof output.overallConsistent === 'boolean',
        (output: z.infer<typeof outputs>) => Array.isArray(output.issues),
      ],
    },
  ],
});

registerPrompt(consistencyValidationPrompt);
