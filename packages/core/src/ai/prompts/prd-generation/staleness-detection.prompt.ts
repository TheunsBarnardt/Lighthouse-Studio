import { z } from 'zod';
import { definePrompt, registerPrompt } from '../../define-prompt.js';

const InputSchema = z.object({
  originalIntentBriefJson: z.string(),
  updatedIntentBriefJson: z.string(),
  prdSectionsJson: z.string(),
});

const OutputSchema = z.object({
  isStale: z.boolean(),
  indicators: z.array(z.object({
    sectionType: z.string(),
    reason: z.string(),
    changedIntentFields: z.array(z.string()),
  })),
  reasoning: z.string(),
});

export const stalenessDetectionPrompt = definePrompt({
  id: 'prd-generation/staleness-detection',
  version: '1.0.0',
  description: 'Detect which PRD sections are stale after an intent brief update',
  inputs: InputSchema,
  outputs: OutputSchema,
  modelConfig: {
    provider: 'anthropic',
    model: 'claude-opus-4-7',
    temperature: 0.1,
    maxTokens: 2000,
  },
  systemPrompt: `You are a requirements analyst. You identify which PRD sections are affected by changes to the intent brief.

Rules:
- A section is stale only if the changed intent fields are directly used by that section
- Purpose is stale if the core problem statement or solution changed
- Scope is stale if in-scope/out-of-scope items changed
- Locked Decisions may be stale if the changed intent fields affect a key constraint
- Non-affected sections should NOT be marked stale
- Only return indicators for actually-stale sections`,
  userPromptTemplate: ({ originalIntentBriefJson, updatedIntentBriefJson, prdSectionsJson }) => `
Identify which PRD sections are stale after the intent brief changed.

Original Intent Brief:
${originalIntentBriefJson}

Updated Intent Brief:
${updatedIntentBriefJson}

Current PRD Sections:
${prdSectionsJson}

Return JSON with:
- isStale: true if any sections need regeneration
- indicators: array of { sectionType, reason, changedIntentFields } for stale sections only
- reasoning: your analysis of what changed and why it matters
`.trim(),
  tests: [
    {
      description: 'Marks purpose as stale when title changes',
      input: {
        originalIntentBriefJson: JSON.stringify({ title: 'Task Manager', goals: [] }),
        updatedIntentBriefJson: JSON.stringify({ title: 'Project Management Suite', goals: [] }),
        prdSectionsJson: JSON.stringify({ purpose: { narrative: 'A task manager...' } }),
      },
      assertions: [
        (output: z.infer<typeof OutputSchema>) => typeof output.isStale === 'boolean',
        (output: z.infer<typeof OutputSchema>) => Array.isArray(output.indicators),
      ],
    },
  ],
});

registerPrompt(stalenessDetectionPrompt);
