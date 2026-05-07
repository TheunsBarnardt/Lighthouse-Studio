import { z } from 'zod';
import { definePrompt, registerPrompt } from '../../define-prompt.js';

const InputSchema = z.object({
  intentBriefJson: z.string(),
  purposeSectionJson: z.string().optional(),
});

const OutputSchema = z.object({
  inScope: z.array(z.string()).min(1),
  outOfScope: z.array(z.string()),
  estimatedSize: z.enum(['small', 'medium', 'large', 'xl']).optional(),
  assumptions: z.array(z.string()),
  reasoning: z.string(),
});

export const scopePrompt = definePrompt({
  id: 'prd-generation/scope',
  version: '1.0.0',
  description: 'Generate the Scope section of a PRD',
  inputs: InputSchema,
  outputs: OutputSchema,
  modelConfig: {
    provider: 'anthropic',
    model: 'claude-opus-4-7',
    temperature: 0.2,
    maxTokens: 1536,
  },
  systemPrompt: `You are a product scope expert. You define clear in/out scope boundaries for PRDs.

Rules:
- inScope items come from explicit goals in the intent brief
- outOfScope items must be explicit ("X is explicitly out of scope") or very clearly implied
- Do not invent out-of-scope items speculatively
- Each scope item is a concrete capability, not vague language
- estimatedSize: small = days-weeks; medium = 1-3 months; large = 3-6 months; xl = 6+ months`,
  userPromptTemplate: ({ intentBriefJson, purposeSectionJson }) => `
Write the Scope section (Section 2 of 13) of the PRD.

Intent Brief:
${intentBriefJson}
${purposeSectionJson ? `\nPurpose section (already written):\n${purposeSectionJson}` : ''}

Return JSON with:
- inScope: array of concrete in-scope capabilities
- outOfScope: array of explicitly out-of-scope items
- estimatedSize: 'small' | 'medium' | 'large' | 'xl' (based on intent brief scope)
- assumptions: list of assumptions that bound the scope
- reasoning: explanation of decisions
`.trim(),
  tests: [
    {
      description: 'Extracts explicit scope from intent brief',
      input: {
        intentBriefJson: JSON.stringify({
          title: 'Blog Platform',
          inScope: ['Create and publish posts', 'Comment moderation'],
          outOfScope: ['Mobile app', 'Paid subscriptions'],
          goals: [{ id: 'g1', description: 'Publish blog posts', priority: 'must_have', acceptanceCriteria: [] }],
        }),
      },
      assertions: [
        (output: z.infer<typeof OutputSchema>) => output.inScope.length >= 1,
        (output: z.infer<typeof OutputSchema>) => output.outOfScope.length >= 1,
      ],
    },
  ],
});

registerPrompt(scopePrompt);
