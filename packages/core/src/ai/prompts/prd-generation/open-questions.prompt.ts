import { z } from 'zod';
import { definePrompt, registerPrompt } from '../../define-prompt.js';

const InputSchema = z.object({
  componentSpecsSectionJson: z.string(),
  hardPartsSectionJson: z.string(),
  intentBriefJson: z.string(),
});

const OutputSchema = z.object({
  questions: z.array(z.object({
    id: z.string(),
    question: z.string(),
    impact: z.enum(['high', 'medium', 'low']),
    resolvedBy: z.string().optional(),
  })),
  reasoning: z.string(),
});

export const openQuestionsPrompt = definePrompt({
  id: 'prd-generation/open-questions',
  version: '1.0.0',
  description: 'Generate the Open Questions section — unresolved items that downstream stages or stakeholders must answer',
  inputs: InputSchema,
  outputs: OutputSchema,
  modelConfig: {
    provider: 'anthropic',
    model: 'claude-opus-4-7',
    temperature: 0.3,
    maxTokens: 1536,
  },
  systemPrompt: `You are a product manager. You surface genuine open questions from the PRD.

Rules:
- Only list questions that are genuinely unresolved
- Each question has an impact level: high = blocks other work, low = nice-to-have clarity
- resolvedBy indicates which stage or review can answer it
- If there are no open questions, return an empty array — that is valid
- Do not invent questions; only surface genuine gaps from the intent brief or component specs`,
  userPromptTemplate: ({ componentSpecsSectionJson, hardPartsSectionJson, intentBriefJson }) => `
Write the Open Questions section (Section 12 of 13) of the PRD.

Intent Brief:
${intentBriefJson}

Component Specifications:
${componentSpecsSectionJson}

Hard Parts:
${hardPartsSectionJson}

Return JSON with:
- questions: array of { id, question, impact, resolvedBy? } (can be empty if no open questions)
- reasoning: why these questions are open
`.trim(),
  tests: [
    {
      description: 'Returns empty questions array when brief is complete',
      input: {
        intentBriefJson: JSON.stringify({ title: 'Simple CRUD App', goals: [], constraints: [] }),
        componentSpecsSectionJson: JSON.stringify({ components: [] }),
        hardPartsSectionJson: JSON.stringify({ items: [] }),
      },
      assertions: [
        (output: z.infer<typeof OutputSchema>) => Array.isArray(output.questions),
      ],
    },
  ],
});

registerPrompt(openQuestionsPrompt);
