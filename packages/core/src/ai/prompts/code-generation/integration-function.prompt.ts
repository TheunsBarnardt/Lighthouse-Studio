import { z } from 'zod';
import { definePrompt, registerPrompt } from '../../define-prompt.js';

const InputSchema = z.object({
  spec: z.object({
    name: z.string(),
    description: z.string(),
    requiredIntegrations: z.array(z.string()),
    requiredPermissions: z.array(z.string()),
    requiredSecrets: z.array(z.string()),
  }).passthrough(),
  integrations: z.array(z.object({
    id: z.string(),
    module: z.string(),
    methods: z.array(z.string()),
    examples: z.array(z.object({ title: z.string(), code: z.string() })),
  })),
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
  id: 'code-generation/integration-function',
  version: '1.0.0',
  description: 'Generate a TypeScript server function using a third-party integration adapter.',
  inputs: InputSchema,
  outputs: OutputSchema,
  modelConfig: { provider: 'anthropic',
 model: 'claude-opus-4-7',
    maxTokens: 3000,
    temperature: 0.1,
  },
  systemPrompt: `You generate TypeScript functions that wrap third-party integrations.

Rules:
- Import from @platform/integrations/<id> — never from the third-party package directly
- Access API keys via ctx.secrets.<secretName>
- Wrap integration errors in typed platform errors
- Log integration calls with logger.info at start and on error
- Include retry logic for transient errors where appropriate

Return JSON with: source, manifestEntry, reasoning.`,
  userPromptTemplate: `Generate a TypeScript function using the following integration(s):
Spec: {{spec | json}}
Integration catalog entries: {{integrations | json}}

Return JSON only.`,
  tests: [],
});

registerPrompt(prompt);
export default prompt;
