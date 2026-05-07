import { z } from 'zod';
import { definePrompt } from '../../define-prompt.js';

const InputSchema = z.object({
  componentCode: z.string(),
  violations: z.array(z.object({ id: z.string(), impact: z.string(), description: z.string(), nodes: z.array(z.string()) })),
});

const OutputSchema = z.object({
  fixedComponentCode: z.string(),
  changes: z.array(z.string()),
  reasoning: z.string(),
});

export const accessibilityFixPrompt = definePrompt({
  id: 'ui-generation.accessibility-fix',
  version: '1.0.0',
  description: 'Fix axe-core accessibility violations in a generated component',
  inputs: InputSchema,
  outputs: OutputSchema,
  modelConfig: { provider: 'anthropic',
 model: 'claude-haiku-4-5-20251001', maxTokens: 4000, temperature: 0.1 },
  systemPrompt: `You fix accessibility violations in React components.

For each axe-core violation, apply the minimal change needed:
- image-alt: add descriptive alt text
- label: associate <label> with input via htmlFor / id
- color-contrast: adjust className to use higher-contrast tokens
- heading-order: fix heading hierarchy
- button-name: add aria-label or text content

Preserve all non-accessibility-related code exactly.
List each change made.`,
  userPromptTemplate: `Violations:
{{#each violations}}- {{this.id}} ({{this.impact}}): {{this.description}} in {{this.nodes.join ", "}}
{{/each}}

Component code:
{{componentCode}}

Fix the violations.`,
  tests: [
    {
      description: 'Adds alt text to image',
      input: {
        componentCode: `<img src="/logo.png" />`,
        violations: [{ id: 'image-alt', impact: 'serious', description: 'Images must have alternative text', nodes: ['img'] }],
      },
      assertions: [
        { path: 'fixedComponentCode', contains: 'alt=' },
      ],
    },
  ],
});
