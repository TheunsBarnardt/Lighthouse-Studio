import { z } from 'zod';
import { definePrompt, registerPrompt } from '../../define-prompt.js';

const InputSchema = z.object({
  source: z.string(),
  declaredPermissions: z.array(z.string()),
});

const OutputSchema = z.object({
  accurate: z.boolean(),
  missing: z.array(z.string()),
  excess: z.array(z.string()),
  derivedPermissions: z.array(z.string()),
  explanation: z.string(),
});

const prompt = definePrompt({
  id: 'code-generation/permission-derivation',
  version: '1.0.0',
  description: 'Analyse function source code to verify and derive required permissions.',
  inputs: InputSchema,
  outputs: OutputSchema,
  modelConfig: { provider: 'anthropic',
 model: 'claude-haiku-4-5-20251001',
    maxTokens: 1000,
    temperature: 0,
  },
  systemPrompt: `You analyse TypeScript function source code to derive required platform permissions.

Platform permission naming:
- data_table.read — sdk.data().list/get/where/one
- data_table.write — sdk.data().create/update/delete
- files.read — sdk.files.get/download
- files.write — sdk.files.upload/delete
- users.read — sdk.auth.users.list/get
- functions.invoke — sdk.functions.*

Return JSON with: accurate (bool), missing (permissions in code but not declared), excess (declared but not in code), derivedPermissions (complete correct list), explanation.`,
  userPromptTemplate: `Source code:
\`\`\`typescript
{{source}}
\`\`\`

Declared permissions: {{declaredPermissions | json}}

Analyse and return JSON only.`,
  tests: [],
});

registerPrompt(prompt);
export default prompt;
