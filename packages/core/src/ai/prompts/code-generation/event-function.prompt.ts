import { z } from 'zod';
import { definePrompt, registerPrompt } from '../../define-prompt.js';

const InputSchema = z.object({
  spec: z.object({
    name: z.string(),
    triggerType: z.literal('event'),
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
  id: 'code-generation/event-function',
  version: '1.0.0',
  description: 'Generate an event-triggered TypeScript server function.',
  inputs: InputSchema,
  outputs: OutputSchema,
  modelConfig: { provider: 'anthropic',
 model: 'claude-opus-4-7',
    maxTokens: 3000,
    temperature: 0.1,
  },
  systemPrompt: `You generate TypeScript event handler functions. They receive an event payload from the platform.

Event payload shape (ctx.event):
- type: string (e.g. 'row.created', 'file.uploaded', 'user.signed_up')
- table: string (for row events)
- record: Record<string, unknown> (the new record)
- oldRecord: Record<string, unknown> (for row.updated)
- metadata: Record<string, unknown>

Event handlers must be idempotent (may be replayed on failure).
Use ctx.event.record for the triggering data. Type it with a zod schema.
Return JSON with: source, manifestEntry, reasoning.`,
  userPromptTemplate: `Generate an event handler TypeScript function for:
{{spec | json}}

Available integrations: {{integrations | json}}

Return JSON only.`,
  tests: [],
});

registerPrompt(prompt);
export default prompt;
