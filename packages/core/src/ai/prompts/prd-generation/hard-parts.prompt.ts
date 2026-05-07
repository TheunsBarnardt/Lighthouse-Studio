import { z } from 'zod';
import { definePrompt, registerPrompt } from '../../define-prompt.js';

const InputSchema = z.object({
  intentBriefJson: z.string(),
  lockedDecisionsSectionJson: z.string(),
});

const OutputSchema = z.object({
  items: z.array(z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    whyHard: z.string(),
    proposedApproach: z.string(),
  })).min(1),
  reasoning: z.string(),
});

export const hardPartsPrompt = definePrompt({
  id: 'prd-generation/hard-parts',
  version: '1.0.0',
  description: 'Identify and describe the hardest technical and product challenges in the PRD',
  inputs: InputSchema,
  outputs: OutputSchema,
  modelConfig: {
    provider: 'anthropic',
    model: 'claude-opus-4-7',
    temperature: 0.3,
    maxTokens: 3000,
  },
  systemPrompt: `You are a senior engineer. You surface the genuinely difficult design problems in a product.

Rules:
- Hard parts are non-obvious challenges, not routine CRUD
- Each item must explain WHY it is hard (concurrency, scale, consistency, UX complexity, etc.)
- The proposed approach is a direction, not a full solution
- Minimum 1 item for any product; typically 3-7 for a medium-to-large product
- Do not list things that are hard only because of inexperience; list genuinely tricky problems
- These items feed Stage 4 (Schema) and Stage 7 (Code) prompts as special attention flags`,
  userPromptTemplate: ({ intentBriefJson, lockedDecisionsSectionJson }) => `
Write the Hard Parts section (Section 5 of 13) of the PRD.

Intent Brief:
${intentBriefJson}

Locked Decisions:
${lockedDecisionsSectionJson}

Return JSON with:
- items: array of { id, title, description, whyHard, proposedApproach }
- reasoning: why these are the hardest parts
`.trim(),
  tests: [
    {
      description: 'Identifies at least one hard part with explanation',
      input: {
        intentBriefJson: JSON.stringify({
          title: 'Real-time Collaboration Tool',
          goals: [{ id: 'g1', description: 'Multiple users edit same document simultaneously', priority: 'must_have', acceptanceCriteria: [] }],
        }),
        lockedDecisionsSectionJson: JSON.stringify({ decisions: [] }),
      },
      assertions: [
        (output: z.infer<typeof OutputSchema>) => output.items.length >= 1,
        (output: z.infer<typeof OutputSchema>) => (output.items[0]?.whyHard?.length ?? 0) > 20,
      ],
    },
  ],
});

registerPrompt(hardPartsPrompt);
