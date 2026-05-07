import { z } from 'zod';
import { definePrompt, registerPrompt } from '../registry.js';

const inputs = z.object({ projectType: z.string(), vibeDescriptors: z.array(z.string()) });

const outputs = z.object({
  none: z.string(), sm: z.string(), base: z.string(), md: z.string(),
  lg: z.string(), xl: z.string(), '2xl': z.string(), full: z.string(),
  reasoning: z.string(),
});

export const borderRadiusPrompt = definePrompt({
  id: 'design-tokens.border-radius',
  version: '1.0.0',
  description: 'Generate border radius tokens',
  inputs,
  outputs,
  modelConfig: { model: 'claude-haiku-4-5-20251001', maxTokens: 512, temperature: 0.2 },
  systemPrompt: `Generate 8 border radius tokens: none=0, sm, base, md, lg, xl, 2xl, full=9999px. Adjust overall scale for vibe (minimal=sharper corners; playful=rounder corners). Use rem or px.`,
  userPromptTemplate: `Project: {{projectType}}, Vibe: {{vibeDescriptors}}. Generate border radius tokens.`,
  tests: [
    {
      name: 'generates border radius tokens',
      input: { projectType: 'CRM', vibeDescriptors: ['professional'] },
      assertions: [
        (output: z.infer<typeof outputs>) => output.none === '0',
        (output: z.infer<typeof outputs>) => output.full === '9999px',
      ],
    },
  ],
});

registerPrompt(borderRadiusPrompt);
