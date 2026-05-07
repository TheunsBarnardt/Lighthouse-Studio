import { z } from 'zod';
import { definePrompt, registerPrompt } from '../../define-prompt.js';

const InputSchema = z.object({
  intentBriefJson: z.string(),
  templateContext: z.string().optional(),
});

const OutputSchema = z.object({
  narrative: z.string().min(50),
  problemStatement: z.string().min(10),
  solutionOverview: z.string().min(10),
  reasoning: z.string(),
});

export const purposePrompt = definePrompt({
  id: 'prd-generation/purpose',
  version: '1.0.0',
  description: 'Generate the Purpose section of a PRD from an approved intent brief',
  inputs: InputSchema,
  outputs: OutputSchema,
  modelConfig: {
    provider: 'anthropic',
    model: 'claude-opus-4-7',
    temperature: 0.2,
    maxTokens: 2048,
  },
  systemPrompt: `You are a product requirements expert. You write clear, precise Purpose sections for Product Requirements Documents.

A Purpose section must:
- Open with a single declarative sentence naming the product and its primary function
- State the problem being solved and for whom
- Describe the solution at a high level without implementation details
- Be 3-5 concise paragraphs
- Use plain language — avoid jargon
- Ground every claim in the intent brief; do not invent requirements`,
  userPromptTemplate: ({ intentBriefJson, templateContext }) => `
Write the Purpose section (Section 1 of 13) of the PRD.

Intent Brief:
${intentBriefJson}
${templateContext ? `\nTemplate hints:\n${templateContext}` : ''}

Return JSON with:
- narrative: 3-5 paragraph narrative (the full section text)
- problemStatement: 1-2 sentence crisp problem statement
- solutionOverview: 1-2 sentence solution description
- reasoning: why you framed it this way
`.trim(),
  tests: [
    {
      description: 'Produces non-empty narrative from a minimal brief',
      input: {
        intentBriefJson: JSON.stringify({
          title: 'CRM for Freelancers',
          summary: 'A lightweight CRM that helps freelancers track clients and deals.',
          goals: [{ id: 'g1', description: 'Track client contacts', priority: 'must_have', acceptanceCriteria: [] }],
          targetUsers: [{ id: 'u1', persona: 'Freelancer', description: 'Self-employed professional', needs: ['contact tracking'], painPoints: ['losing track of leads'] }],
        }),
      },
      assertions: [
        (output: z.infer<typeof OutputSchema>) => output.narrative.length > 50,
        (output: z.infer<typeof OutputSchema>) => output.problemStatement.length > 0,
      ],
    },
  ],
});

registerPrompt(purposePrompt);
