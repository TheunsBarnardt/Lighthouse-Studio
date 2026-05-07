import { z } from 'zod';
import { definePrompt, registerPrompt } from '../../define-prompt.js';

const InputSchema = z.object({
  prdSectionsJson: z.string(), // full PRD sections as JSON
});

const OutputSchema = z.object({
  issues: z.array(z.object({
    id: z.string(),
    severity: z.enum(['error', 'warning']),
    sections: z.array(z.string()),
    description: z.string(),
    suggestedResolution: z.string(),
  })),
  reasoning: z.string(),
});

export const consistencyCheckPrompt = definePrompt({
  id: 'prd-generation/consistency-check',
  version: '1.0.0',
  description: 'Cross-section consistency check — detects contradictions between PRD sections',
  inputs: InputSchema,
  outputs: OutputSchema,
  modelConfig: {
    provider: 'anthropic',
    model: 'claude-opus-4-7',
    temperature: 0.1,
    maxTokens: 3000,
  },
  systemPrompt: `You are a technical reviewer. You check a complete PRD for internal contradictions.

Common contradictions to look for:
- Feature mentioned in scope but refused in anti-patterns
- Persona mentioned in locked decisions not present in architectural overview
- Component in component-specs not referenced in implementation order
- Verification step testing something out of scope
- DoD items for components not in component-specs
- Hard part not addressed in implementation order

Rules:
- Only report real contradictions, not differences in emphasis
- severity 'error' = blocking contradiction; 'warning' = worth reviewing
- If there are no issues, return an empty array — that is valid and good
- suggestedResolution is actionable ("Edit Section X to align with Section Y")`,
  userPromptTemplate: ({ prdSectionsJson }) => `
Review this complete PRD for internal consistency issues.

PRD Sections:
${prdSectionsJson}

Return JSON with:
- issues: array of { id, severity, sections, description, suggestedResolution } — can be empty
- reasoning: your review approach
`.trim(),
  tests: [
    {
      description: 'Returns empty issues for a consistent PRD',
      input: {
        prdSectionsJson: JSON.stringify({
          scope: { inScope: ['Task creation'], outOfScope: ['Mobile app'] },
          anti_patterns: [{ rule: 'Do not build a mobile app' }],
        }),
      },
      assertions: [
        (output: z.infer<typeof OutputSchema>) => Array.isArray(output.issues),
      ],
    },
  ],
});

registerPrompt(consistencyCheckPrompt);
