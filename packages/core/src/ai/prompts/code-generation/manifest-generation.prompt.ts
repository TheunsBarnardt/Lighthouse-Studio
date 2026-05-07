import { z } from 'zod';
import { definePrompt, registerPrompt } from '../../define-prompt.js';

const InputSchema = z.object({
  workspaceId: z.string(),
  projectId: z.string(),
  functions: z.array(z.object({
    name: z.string(),
    triggerType: z.string(),
    triggerConfig: z.record(z.unknown()),
    permissions: z.array(z.string()),
    secrets: z.array(z.string()),
    integrations: z.array(z.string()),
  })),
});

const OutputSchema = z.object({
  manifest: z.object({
    workspaceId: z.string(),
    projectId: z.string(),
    functions: z.array(z.record(z.unknown())),
    integrationsUsed: z.array(z.string()),
    estimatedMonthlyCostUsd: z.number(),
  }),
  reasoning: z.string(),
});

const prompt = definePrompt({
  id: 'code-generation/manifest-generation',
  version: '1.0.0',
  description: 'Assemble the server manifest from all generated function entries.',
  inputs: InputSchema,
  outputs: OutputSchema,
  modelConfig: {
    model: 'claude-haiku-4-5-20251001',
    maxTokens: 2000,
    temperature: 0,
  },
  systemPrompt: `You assemble a server manifest from a list of function descriptors.
Estimate monthly cost based on: 100 invocations/day per HTTP function, 30/day per scheduled, 200/day per event.
Cost per invocation ≈ $0.000001 (Node.js serverless pricing estimate).
Return JSON only.`,
  userPromptTemplate: `Workspace: {{workspaceId}}, Project: {{projectId}}
Functions: {{functions | json}}
Assemble the manifest. Return JSON only.`,
  tests: [],
});

registerPrompt(prompt);
export default prompt;
