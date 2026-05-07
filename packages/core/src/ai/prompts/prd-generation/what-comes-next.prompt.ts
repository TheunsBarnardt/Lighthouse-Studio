import { z } from 'zod';
import { definePrompt, registerPrompt } from '../../define-prompt.js';

const InputSchema = z.object({
  definitionOfDoneSectionJson: z.string(),
  implementationOrderSectionJson: z.string(),
});

const OutputSchema = z.object({
  narrative: z.string().min(20),
  nextStage: z.string(),
  dependenciesForNextStage: z.array(z.string()),
  reasoning: z.string(),
});

export const whatComesNextPrompt = definePrompt({
  id: 'prd-generation/what-comes-next',
  version: '1.0.0',
  description: 'Generate the What Comes Next section — bridges this PRD to downstream AI pipeline stages',
  inputs: InputSchema,
  outputs: OutputSchema,
  modelConfig: {
    provider: 'anthropic',
    model: 'claude-opus-4-7',
    temperature: 0.2,
    maxTokens: 1024,
  },
  systemPrompt: `You are a product lead. You bridge this PRD to the next stage in the AI build pipeline.

The pipeline stages after PRD (Stage 2) are:
- Stage 3: Design Tokens — visual language (colors, typography, spacing)
- Stage 4: Schema Synthesis — database schema
- Stage 5: Data Migration — for projects with existing data
- Stage 6: UI Generation — components from tokens + schema
- Stage 7: Code Generation — server-side logic
- Stage 8: Test Generation — test suites from acceptance criteria
- Stage 9: Deployment — through environments

Rules:
- Identify which stage comes next (typically Stage 3: Design Tokens)
- dependenciesForNextStage are DoD items from Section 10 that must be complete before proceeding
- Narrative is 2-3 sentences bridging this PRD to the next stage`,
  userPromptTemplate: ({ definitionOfDoneSectionJson, implementationOrderSectionJson }) => `
Write the What Comes Next section (Section 13 of 13) of the PRD.

Definition of Done:
${definitionOfDoneSectionJson}

Implementation Order:
${implementationOrderSectionJson}

Return JSON with:
- narrative: 2-3 sentences describing what happens after this PRD is approved
- nextStage: name of the next AI pipeline stage
- dependenciesForNextStage: DoD items that must be complete before the next stage starts
- reasoning: the handoff logic
`.trim(),
  tests: [
    {
      description: 'Identifies the next stage and lists dependencies',
      input: {
        definitionOfDoneSectionJson: JSON.stringify({ items: [{ id: 'd1', category: 'Schema', description: 'All tables defined', stage: '4' }] }),
        implementationOrderSectionJson: JSON.stringify({ steps: [{ step: 1, title: 'Database schema', description: '...', dependsOnSteps: [] }] }),
      },
      assertions: [
        (output: z.infer<typeof OutputSchema>) => output.nextStage.length > 0,
        (output: z.infer<typeof OutputSchema>) => output.narrative.length >= 20,
      ],
    },
  ],
});

registerPrompt(whatComesNextPrompt);
