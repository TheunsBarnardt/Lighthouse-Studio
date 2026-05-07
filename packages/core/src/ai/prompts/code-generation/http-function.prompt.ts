import { z } from 'zod';
import { definePrompt, registerPrompt } from '../../define-prompt.js';

const InputSchema = z.object({
  spec: z.object({
    name: z.string(),
    triggerType: z.literal('http'),
    triggerConfig: z.record(z.unknown()),
    description: z.string(),
    inputs: z.array(z.object({ name: z.string(), type: z.string(), required: z.boolean() })),
    outputs: z.array(z.object({ name: z.string(), type: z.string(), required: z.boolean() })),
    requiredPermissions: z.array(z.string()),
    requiredSecrets: z.array(z.string()),
    requiredIntegrations: z.array(z.string()),
  }).passthrough(),
  integrations: z.array(z.object({ id: z.string(), module: z.string(), methods: z.array(z.string()) })).optional(),
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
  id: 'code-generation/http-function',
  version: '1.0.0',
  description: 'Generate an HTTP-triggered TypeScript server function.',
  inputs: InputSchema,
  outputs: OutputSchema,
  modelConfig: { provider: 'anthropic',
 model: 'claude-opus-4-7',
    maxTokens: 3000,
    temperature: 0.1,
  },
  systemPrompt: `You generate TypeScript server functions that run in a sandboxed Node.js 22 runtime.

Function shape:
\`\`\`typescript
import type { FunctionContext } from '@platform/runtime';
import { z } from 'zod';
import { NotFoundError, ValidationError } from '@platform/runtime/errors';

const InputSchema = z.object({ /* ... */ });

export async function functionName(rawInput: unknown, ctx: FunctionContext): Promise<Output> {
  const input = InputSchema.parse(rawInput);
  const { sdk, logger, secrets } = ctx;
  // implementation
}

export const manifest = { name: '...', trigger: { type: 'http', method: '...', path: '...' }, permissions: [], secrets: [], rateLimit: { requestsPerMinute: 100 }, timeout: 30000 };
\`\`\`

Rules:
- Validate input with zod before any logic
- Use ctx.sdk for data operations
- Use ctx.secrets for API keys (never hardcode)
- No eval, no require(), no process.env
- No imports outside: @platform/*, zod, lodash, date-fns
- Throw typed errors from @platform/runtime/errors
- Return structured output matching the spec
- Include manifest export

Return JSON with: source (full TypeScript), manifestEntry, reasoning.`,
  userPromptTemplate: `Generate a TypeScript HTTP function for:
{{spec | json}}

Available integrations: {{integrations | json}}

Return JSON only.`,
  tests: [],
});

registerPrompt(prompt);
export default prompt;
