import { z } from 'zod';
import { definePrompt, registerPrompt } from '../../define-prompt.js';

const InputSchema = z.object({
  intentBriefJson: z.string(),
  purposeSectionJson: z.string(),
});

const OutputSchema = z.object({
  decisions: z.array(z.object({
    decision: z.string(),
    choice: z.string(),
    rationale: z.string(),
    tracesTo: z.array(z.object({ type: z.string(), artifactId: z.string(), fieldPath: z.string() })),
  })).min(1),
  reasoning: z.string(),
});

export const lockedDecisionsPrompt = definePrompt({
  id: 'prd-generation/locked-decisions',
  version: '1.0.0',
  description: 'Generate the Locked Decisions section of a PRD',
  inputs: InputSchema,
  outputs: OutputSchema,
  modelConfig: {
    provider: 'anthropic',
    model: 'claude-opus-4-7',
    temperature: 0.2,
    maxTokens: 2048,
  },
  systemPrompt: `You are a technical architect. You identify architectural and product decisions that are implicitly or explicitly made by the intent brief and cannot be revisited without major rework.

Rules:
- Each decision must be non-obvious — trivial choices are not "locked"
- Each decision traces back to an intent brief field
- Rationale must reference the intent, not just restate the choice
- Format: Decision (the question) | Choice (the answer) | Rationale (why locked)
- Minimum 3 decisions for any real product; aim for 5-8`,
  userPromptTemplate: ({ intentBriefJson, purposeSectionJson }) => `
Write the Locked Decisions section (Section 3 of 13) of the PRD.

Intent Brief:
${intentBriefJson}

Purpose section:
${purposeSectionJson}

Return JSON with:
- decisions: array of { decision, choice, rationale, tracesTo }
- reasoning: your analysis of what locks these decisions
`.trim(),
  tests: [
    {
      description: 'Produces at least one locked decision with rationale',
      input: {
        intentBriefJson: JSON.stringify({
          title: 'CRM',
          goals: [{ id: 'g1', description: 'Multi-user access', priority: 'must_have', acceptanceCriteria: [] }],
          constraints: [{ id: 'c1', type: 'technical', description: 'Must use existing Postgres DB', severity: 'hard' }],
        }),
        purposeSectionJson: JSON.stringify({ narrative: 'A CRM for teams.', problemStatement: '...', solutionOverview: '...' }),
      },
      assertions: [
        (output: z.infer<typeof OutputSchema>) => output.decisions.length >= 1,
        (output: z.infer<typeof OutputSchema>) => output.decisions.every((d) => d.rationale.length > 0),
      ],
    },
  ],
});

registerPrompt(lockedDecisionsPrompt);
