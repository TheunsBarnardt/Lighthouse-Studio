import { z } from 'zod';
import { definePrompt, registerPrompt } from '../../define-prompt.js';

const InputSchema = z.object({
  lockedDecisionsSectionJson: z.string(),
  hardPartsSectionJson: z.string(),
});

const OutputSchema = z.object({
  adrs: z.array(z.object({
    title: z.string(),
    context: z.string(),
    rationaleSummary: z.string(),
  })).min(1),
  reasoning: z.string(),
});

export const adrsToWritePrompt = definePrompt({
  id: 'prd-generation/adrs-to-write',
  version: '1.0.0',
  description: 'Generate the ADRs to Write section of a PRD — stubs that Stage 7 scaffolds into docs/adr/',
  inputs: InputSchema,
  outputs: OutputSchema,
  modelConfig: {
    provider: 'anthropic',
    model: 'claude-opus-4-7',
    temperature: 0.2,
    maxTokens: 2048,
  },
  systemPrompt: `You are an architect who maintains decision records. You identify which decisions in this PRD warrant a formal ADR.

Rules:
- One ADR per significant architectural decision (not every detail)
- Each ADR title is imperative: "Use X for Y" or "Choose X over Y"
- Context explains why the decision was needed
- RationaleSummary explains why this choice was made (1-3 sentences)
- Stage 7 (Code Generation) scaffolds these into the generated app's docs/adr/ folder (per ADR-0261)
- Aim for 3-10 ADRs; typical is 5-7`,
  userPromptTemplate: ({ lockedDecisionsSectionJson, hardPartsSectionJson }) => `
Write the ADRs to Write section (Section 8 of 13) of the PRD.

Locked Decisions (each becomes a candidate ADR):
${lockedDecisionsSectionJson}

Hard Parts (technical decisions in here may also warrant ADRs):
${hardPartsSectionJson}

Return JSON with:
- adrs: array of { title, context, rationaleSummary }
- reasoning: which decisions made the cut and why
`.trim(),
  tests: [
    {
      description: 'Produces at least one ADR stub per locked decision',
      input: {
        lockedDecisionsSectionJson: JSON.stringify({ decisions: [{ decision: 'Database', choice: 'PostgreSQL', rationale: 'Relational model suits the data', tracesTo: [] }] }),
        hardPartsSectionJson: JSON.stringify({ items: [] }),
      },
      assertions: [
        (output: z.infer<typeof OutputSchema>) => output.adrs.length >= 1,
        (output: z.infer<typeof OutputSchema>) => output.adrs.every((a) => a.title.length > 0 && a.context.length > 0),
      ],
    },
  ],
});

registerPrompt(adrsToWritePrompt);
