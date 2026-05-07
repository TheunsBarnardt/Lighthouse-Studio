import { z } from 'zod';
import { definePrompt, registerPrompt } from '../../define-prompt.js';

const InputSchema = z.object({
  spec: z.object({
    name: z.string(),
    triggerType: z.literal('schedule'),
    triggerConfig: z.record(z.unknown()),
    description: z.string(),
    requiredPermissions: z.array(z.string()),
    requiredSecrets: z.array(z.string()),
  }).passthrough(),
  integrations: z.array(z.object({ id: z.string(), module: z.string() })).optional(),
});

const OutputSchema = z.object({
  source: z.string(),
  manifestEntry: z.record(z.unknown()),
  reasoning: z.object({
    whyThisFunctionExists: z.string(),
    whyThisImplementation: z.string(),
    designDecisions: z.array(z.string()),
  }),
});

const prompt = definePrompt({
  id: 'code-generation/scheduled-function',
  version: '1.0.0',
  description: 'Generate a cron-scheduled TypeScript server function.',
  inputs: InputSchema,
  outputs: OutputSchema,
  modelConfig: { provider: 'anthropic',
 model: 'claude-opus-4-7',
    maxTokens: 3000,
    temperature: 0.1,
  },
  systemPrompt: `You generate TypeScript scheduled functions. They receive no user input — just ctx.
Scheduled functions must be idempotent: running twice should produce the same result.
Use cursor-based pagination for bulk operations. Never process unbounded data sets.
Include a manifest export with cron expression.
Return JSON with: source, manifestEntry, reasoning.`,
  userPromptTemplate: `Generate a scheduled TypeScript function for:
{{spec | json}}

Available integrations: {{integrations | json}}

Return JSON only.`,
  tests: [],
});

registerPrompt(prompt);
export default prompt;
