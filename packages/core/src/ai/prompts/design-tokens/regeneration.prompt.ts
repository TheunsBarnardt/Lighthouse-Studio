import { z } from 'zod';
import { definePrompt, registerPrompt } from '../registry.js';

const inputs = z.object({
  category: z.enum(['colors', 'typography', 'spacing', 'sizing', 'borderRadius', 'shadows', 'motion', 'zIndex', 'breakpoints']),
  currentTokens: z.record(z.unknown()),
  feedback: z.string(),
  brandInputs: z.object({ vibeDescriptors: z.array(z.string()), brandColors: z.array(z.object({ name: z.string(), hex: z.string(), locked: z.boolean() })).optional() }),
});

const outputs = z.object({
  updatedTokens: z.record(z.unknown()),
  reasoning: z.string(),
});

export const regenerationPrompt = definePrompt({
  id: 'design-tokens.regeneration',
  version: '1.0.0',
  description: 'Regenerate a specific token category with user feedback',
  inputs,
  outputs,
  modelConfig: { model: 'claude-opus-4-7', maxTokens: 3000, temperature: 0.4 },
  systemPrompt: `Regenerate a specific design token category based on user feedback. Preserve locked brand colors exactly. Return tokens in the same structure as the input. Apply the feedback meaningfully — if the user says "more muted", reduce saturation.`,
  userPromptTemplate: `Category: {{category}}. Current tokens: {{currentTokens}}. User feedback: "{{feedback}}". Brand inputs: {{brandInputs}}. Regenerate this category.`,
  tests: [
    {
      name: 'regenerates tokens with feedback',
      input: {
        category: 'colors', currentTokens: { primary: { '500': '#3b82f6' } },
        feedback: 'more muted, less saturated',
        brandInputs: { vibeDescriptors: ['professional'] },
      },
      assertions: [
        (output: z.infer<typeof outputs>) => typeof output.updatedTokens === 'object',
        (output: z.infer<typeof outputs>) => output.reasoning.length > 20,
      ],
    },
  ],
});

registerPrompt(regenerationPrompt);
