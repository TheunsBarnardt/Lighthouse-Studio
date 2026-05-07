import { z } from 'zod';
import { definePrompt } from '../../define-prompt.js';

const InputSchema = z.object({
  components: z.array(z.object({ name: z.string(), code: z.string().max(2000) })),
  designTokens: z.object({ primaryColor: z.string(), fontFamily: z.string() }),
});

const OutputSchema = z.object({
  passed: z.boolean(),
  issues: z.array(z.object({ component: z.string(), issue: z.string(), severity: z.enum(['error', 'warning']) })),
  suggestions: z.array(z.string()),
  reasoning: z.string(),
});

export const consistencyCheckPrompt = definePrompt({
  id: 'ui-generation.consistency-check',
  version: '1.0.0',
  description: 'Verify that generated components are visually and structurally consistent with each other',
  inputs: InputSchema,
  outputs: OutputSchema,
  modelConfig: { model: 'claude-haiku-4-5-20251001', maxTokens: 2000, temperature: 0.1 },
  systemPrompt: `You verify consistency across generated React components.

Check for:
- Inconsistent button styles (different variants for same action type)
- Inconsistent heading levels
- Inconsistent import patterns
- Inconsistent spacing (different padding/margin patterns for same element type)
- Hardcoded colors not from design tokens
- Different patterns for the same operation (e.g., different ways to show loading state)

Report issues per component. Return passed=true if no errors (warnings don't block).`,
  userPromptTemplate: `Design tokens: primary={{designTokens.primaryColor}}, font={{designTokens.fontFamily}}

Components to check:
{{#each components}}
=== {{this.name}} ===
{{this.code}}
{{/each}}

Check for consistency issues.`,
  tests: [
    {
      description: 'Passes consistent components',
      input: {
        components: [{ name: 'ContactList', code: 'export function ContactList() {}' }],
        designTokens: { primaryColor: '#3B82F6', fontFamily: 'Inter' },
      },
      assertions: [
        { path: 'issues.length', equals: 0 },
      ],
    },
  ],
});
