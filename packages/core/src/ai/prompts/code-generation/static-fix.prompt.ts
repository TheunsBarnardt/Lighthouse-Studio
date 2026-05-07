import { z } from 'zod';
import { definePrompt, registerPrompt } from '../../define-prompt.js';

const InputSchema = z.object({
  source: z.string(),
  violations: z.array(z.object({
    type: z.string(),
    line: z.number(),
    message: z.string(),
  })),
});

const OutputSchema = z.object({
  source: z.string(),
  fixedViolations: z.array(z.string()),
  explanation: z.string(),
});

const prompt = definePrompt({
  id: 'code-generation/static-fix',
  version: '1.0.0',
  description: 'Fix static analysis violations in generated server code.',
  inputs: InputSchema,
  outputs: OutputSchema,
  modelConfig: {
    model: 'claude-haiku-4-5-20251001',
    maxTokens: 2000,
    temperature: 0,
  },
  systemPrompt: `You fix static analysis violations in TypeScript sandbox functions.

For each violation:
- forbidden_import: replace with an approved equivalent or remove
- forbidden_call (eval, new Function): replace with equivalent safe implementation
- sandbox_escape_attempt: remove or rewrite using approved patterns
- unsafe_pattern (process.env): replace with ctx.secrets equivalents
- missing_permission_declaration: not fixed here (handled by service layer)

Minimal changes: only fix the violations, leave all other code unchanged.
Return JSON with: source (fixed code), fixedViolations (list of what was fixed), explanation.`,
  userPromptTemplate: `Violations:
{{violations | json}}

Source code:
\`\`\`typescript
{{source}}
\`\`\`

Fix the violations. Return JSON only.`,
  tests: [],
});

registerPrompt(prompt);
export default prompt;
