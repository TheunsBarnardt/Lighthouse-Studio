import { z } from 'zod';
import { definePrompt, registerPrompt } from '../../define-prompt.js';

const InputSchema = z.object({
  intentBriefJson: z.string(),
  lockedDecisionsSectionJson: z.string(),
  componentSpecsSectionJson: z.string().optional(),
});

const OutputSchema = z.object({
  narrative: z.string().min(50),
  diagram: z.string().min(20), // mermaid or ASCII
  components: z.array(z.object({ name: z.string(), role: z.string() })).min(1),
  reasoning: z.string(),
});

export const architecturalOverviewPrompt = definePrompt({
  id: 'prd-generation/architectural-overview',
  version: '1.0.0',
  description: 'Generate the Architectural Overview section of a PRD',
  inputs: InputSchema,
  outputs: OutputSchema,
  modelConfig: {
    provider: 'anthropic',
    model: 'claude-opus-4-7',
    temperature: 0.2,
    maxTokens: 3000,
  },
  systemPrompt: `You are a software architect. You produce clear architectural overviews that guide engineers.

Rules:
- The diagram must use mermaid flowchart syntax (graph LR or TD)
- Components must reference the names from the Locked Decisions and Component Specs sections
- Narrative explains the data flow and component interactions in plain English
- Do not invent infrastructure not implied by the intent brief
- Focus on the high-level architecture, not implementation details`,
  userPromptTemplate: ({ intentBriefJson, lockedDecisionsSectionJson, componentSpecsSectionJson }) => `
Write the Architectural Overview section (Section 4 of 13) of the PRD.

Intent Brief:
${intentBriefJson}

Locked Decisions:
${lockedDecisionsSectionJson}
${componentSpecsSectionJson ? `\nComponent Specifications:\n${componentSpecsSectionJson}` : ''}

Return JSON with:
- narrative: plain English description of the architecture and data flows (2-4 paragraphs)
- diagram: mermaid flowchart diagram showing the major components and their connections
- components: array of { name, role } for each major component in the diagram
- reasoning: your architectural thinking
`.trim(),
  tests: [
    {
      description: 'Produces a mermaid diagram with at least two nodes',
      input: {
        intentBriefJson: JSON.stringify({ title: 'Task Manager', goals: [] }),
        lockedDecisionsSectionJson: JSON.stringify({ decisions: [{ decision: 'Database', choice: 'PostgreSQL', rationale: 'Relational data model', tracesTo: [] }] }),
      },
      assertions: [
        (output: z.infer<typeof OutputSchema>) => output.diagram.includes('graph') || output.diagram.includes('flowchart'),
        (output: z.infer<typeof OutputSchema>) => output.components.length >= 2,
      ],
    },
  ],
});

registerPrompt(architecturalOverviewPrompt);
