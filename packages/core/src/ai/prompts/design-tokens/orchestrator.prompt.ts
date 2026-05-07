import { z } from 'zod';
import { definePrompt, registerPrompt } from '../registry.js';

const inputs = z.object({
  prdSummary: z.string(),
  brandInputs: z.object({
    vibeDescriptors: z.array(z.string()),
    brandColors: z.array(z.object({ name: z.string(), hex: z.string(), locked: z.boolean() })).optional(),
    referenceUrls: z.array(z.string()).optional(),
  }),
  projectType: z.string(),
  targetUsers: z.string(),
});

const outputs = z.object({
  generationPlan: z.array(z.object({
    category: z.string(),
    rationale: z.string(),
    specialConsiderations: z.string().optional(),
  })),
  overallDesignDirection: z.string(),
  reasoning: z.string(),
});

export const orchestratorPrompt = definePrompt({
  id: 'design-tokens.orchestrator',
  version: '1.0.0',
  description: 'Plan design token generation from PRD and brand inputs',
  inputs,
  outputs,
  modelConfig: { model: 'claude-opus-4-7', maxTokens: 2048, temperature: 0.3 },
  systemPrompt: `You are a design system strategist. Given a PRD and brand inputs, produce a generation plan for all token categories. Define the overall design direction that will guide each category prompt. Identify any special considerations (e.g., locked brand colors, specific accessibility requirements).`,
  userPromptTemplate: `PRD summary: {{prdSummary}}
Brand inputs: {{brandInputs}}
Project type: {{projectType}}
Target users: {{targetUsers}}

Plan the design token generation. Define the design direction and per-category considerations.`,
  tests: [
    {
      name: 'produces a generation plan',
      input: {
        prdSummary: 'A CRM for sales teams', brandInputs: { vibeDescriptors: ['professional', 'trustworthy'] },
        projectType: 'CRM', targetUsers: 'Sales professionals',
      },
      assertions: [
        (output: z.infer<typeof outputs>) => output.generationPlan.length >= 5,
        (output: z.infer<typeof outputs>) => output.overallDesignDirection.length > 30,
      ],
    },
  ],
});

registerPrompt(orchestratorPrompt);
