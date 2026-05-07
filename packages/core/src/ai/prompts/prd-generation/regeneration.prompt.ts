import { z } from 'zod';
import { definePrompt, registerPrompt } from '../../define-prompt.js';

const InputSchema = z.object({
  sectionType: z.string(),
  currentSectionJson: z.string(),
  userFeedback: z.string(),
  intentBriefJson: z.string(),
  otherApprovedSectionsJson: z.string().optional(),
});

const OutputSchema = z.object({
  revisedContent: z.record(z.unknown()),
  changesSummary: z.string(),
  reasoning: z.string(),
});

export const regenerationPrompt = definePrompt({
  id: 'prd-generation/regeneration',
  version: '1.0.0',
  description: 'Regenerate a single PRD section incorporating user feedback without touching other approved sections',
  inputs: InputSchema,
  outputs: OutputSchema,
  modelConfig: {
    provider: 'anthropic',
    model: 'claude-opus-4-7',
    temperature: 0.25,
    maxTokens: 4096,
  },
  systemPrompt: `You are a product requirements expert revising a specific section of a PRD.

Rules:
- Apply the user's feedback specifically; do not make unrelated changes
- Preserve any elements the user did not request to change
- The revised section must remain consistent with the other approved sections provided
- The section structure (field names) must match the original exactly
- changesSummary explains what changed and why (1-3 sentences)`,
  userPromptTemplate: ({ sectionType, currentSectionJson, userFeedback, intentBriefJson, otherApprovedSectionsJson }) => `
Revise the "${sectionType}" section of the PRD based on the user's feedback.

Current section content:
${currentSectionJson}

User feedback:
${userFeedback}

Intent Brief (for grounding):
${intentBriefJson}
${otherApprovedSectionsJson ? `\nOther approved sections (do not contradict these):\n${otherApprovedSectionsJson}` : ''}

Return JSON with:
- revisedContent: the updated section content (same structure as the original)
- changesSummary: 1-3 sentence summary of what changed
- reasoning: why you made these specific changes
`.trim(),
  tests: [
    {
      description: 'Applies feedback and returns same structure',
      input: {
        sectionType: 'purpose',
        currentSectionJson: JSON.stringify({ narrative: 'A task manager.', problemStatement: 'Teams lose track of work.', solutionOverview: 'Centralised task list.' }),
        userFeedback: 'Make the narrative more specific about project management.',
        intentBriefJson: JSON.stringify({ title: 'Task Manager' }),
      },
      assertions: [
        (output: z.infer<typeof OutputSchema>) => typeof output.revisedContent === 'object',
        (output: z.infer<typeof OutputSchema>) => output.changesSummary.length > 0,
      ],
    },
  ],
});

registerPrompt(regenerationPrompt);
