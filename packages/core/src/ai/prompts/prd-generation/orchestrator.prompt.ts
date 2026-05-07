import { z } from 'zod';
import { definePrompt, registerPrompt } from '../../define-prompt.js';

const InputSchema = z.object({
  intentBriefJson: z.string(),
  sectionsToGenerate: z.array(z.string()),
  templateContext: z.string().optional(),
});

const OutputSchema = z.object({
  generationPlan: z.array(z.object({
    sectionType: z.string(),
    dependsOn: z.array(z.string()),
    priority: z.number(),
  })),
  estimatedCostUsd: z.number(),
  reasoning: z.string(),
});

export const orchestratorPrompt = definePrompt({
  id: 'prd-generation/orchestrator',
  version: '1.0.0',
  description: 'Plan the PRD section generation order based on dependency graph and estimate cost',
  inputs: InputSchema,
  outputs: OutputSchema,
  modelConfig: {
    provider: 'anthropic',
    model: 'claude-opus-4-7',
    temperature: 0.1,
    maxTokens: 1024,
  },
  systemPrompt: `You are a generation orchestrator. You plan the topological order for generating PRD sections.

The dependency graph is fixed:
- purpose: no deps
- scope: no deps
- locked_decisions: depends on purpose
- hard_parts: depends on locked_decisions
- component_specifications: depends on locked_decisions, scope
- architectural_overview: depends on locked_decisions, component_specifications
- implementation_order: depends on component_specifications, hard_parts
- adrs_to_write: depends on locked_decisions, hard_parts
- verification_steps: depends on component_specifications
- definition_of_done: depends on component_specifications, verification_steps
- anti_patterns: depends on locked_decisions, scope
- open_questions: depends on component_specifications, hard_parts
- what_comes_next: depends on definition_of_done

estimatedCostUsd: estimated total cost across all sections ($1-5 typical)`,
  userPromptTemplate: ({ intentBriefJson, sectionsToGenerate, templateContext }) => `
Plan the generation of these PRD sections: ${sectionsToGenerate.join(', ')}

Intent Brief:
${intentBriefJson}
${templateContext ? `\nTemplate context:\n${templateContext}` : ''}

Return JSON with:
- generationPlan: ordered array of { sectionType, dependsOn, priority } where priority 1 = generate first
- estimatedCostUsd: estimated total cost
- reasoning: the sequencing rationale
`.trim(),
  tests: [
    {
      description: 'Plans purpose before locked_decisions',
      input: {
        intentBriefJson: JSON.stringify({ title: 'App' }),
        sectionsToGenerate: ['purpose', 'locked_decisions'],
      },
      assertions: [
        (output: z.infer<typeof OutputSchema>) => {
          const purposeItem = output.generationPlan.find((p) => p.sectionType === 'purpose');
          const ldItem = output.generationPlan.find((p) => p.sectionType === 'locked_decisions');
          return purposeItem !== undefined && ldItem !== undefined && purposeItem.priority <= ldItem.priority;
        },
      ],
    },
  ],
});

registerPrompt(orchestratorPrompt);
