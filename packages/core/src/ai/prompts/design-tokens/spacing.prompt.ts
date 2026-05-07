import { z } from 'zod';
import { definePrompt, registerPrompt } from '../registry.js';

const inputs = z.object({
  projectType: z.string(),
  vibeDescriptors: z.array(z.string()),
  baseUnit: z.number().optional().default(4),
});

const outputs = z.object({
  '0': z.string(), '1': z.string(), '2': z.string(), '3': z.string(), '4': z.string(),
  '5': z.string(), '6': z.string(), '8': z.string(), '10': z.string(), '12': z.string(),
  '16': z.string(), '20': z.string(), '24': z.string(),
  reasoning: z.string(),
});

export const spacingPrompt = definePrompt({
  id: 'design-tokens.spacing',
  version: '1.0.0',
  description: 'Generate spacing scale tokens',
  inputs,
  outputs,
  modelConfig: { model: 'claude-haiku-4-5-20251001', maxTokens: 1024, temperature: 0.1 },
  systemPrompt: `Generate a 13-step spacing scale using rem values based on a 4px base unit. Values must follow visual rhythm (0, 0.25rem, 0.5rem, 0.75rem, 1rem, 1.25rem, 1.5rem, 2rem, 2.5rem, 3rem, 4rem, 5rem, 6rem).`,

  userPromptTemplate: `Project: {{projectType}}, Vibe: {{vibeDescriptors}}, Base unit: {{baseUnit}}px. Generate 13 spacing tokens.`,

  tests: [
    {
      name: 'generates 13 spacing values',
      input: { projectType: 'CRM', vibeDescriptors: ['professional'], baseUnit: 4 },
      assertions: [
        (output: z.infer<typeof outputs>) => output['0'] === '0',
        (output: z.infer<typeof outputs>) => output['4'].endsWith('rem'),
      ],
    },
  ],
});

registerPrompt(spacingPrompt);
