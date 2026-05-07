import { z } from 'zod';
import { definePrompt, registerPrompt } from '../../define-prompt.js';

const InputSchema = z.object({
  intentBriefJson: z.string(),
  lockedDecisionsSectionJson: z.string(),
  scopeSectionJson: z.string(),
});

const OutputSchema = z.object({
  components: z.array(z.object({
    name: z.string(),
    type: z.string(),
    description: z.string(),
    interfaceStub: z.string().optional(),
    dependsOn: z.array(z.string()),
  })).min(1),
  reasoning: z.string(),
});

export const componentSpecificationsPrompt = definePrompt({
  id: 'prd-generation/component-specifications',
  version: '1.0.0',
  description: 'Generate the Component Specifications section of a PRD',
  inputs: InputSchema,
  outputs: OutputSchema,
  modelConfig: {
    provider: 'anthropic',
    model: 'claude-opus-4-7',
    temperature: 0.2,
    maxTokens: 4096,
  },
  systemPrompt: `You are a software architect. You produce typed component specifications that engineers can use as scaffolding.

Rules:
- Components include: data models, services, API endpoints, UI components, background jobs
- Each component has a typed interface stub in TypeScript
- dependsOn lists the names of other components in the same list
- Do not invent components not implied by the intent brief
- Stage 7 (Code Generation) consumes these specs as scaffolding; be specific about types`,
  userPromptTemplate: ({ intentBriefJson, lockedDecisionsSectionJson, scopeSectionJson }) => `
Write the Component Specifications section (Section 6 of 13) of the PRD.

Intent Brief:
${intentBriefJson}

Locked Decisions:
${lockedDecisionsSectionJson}

Scope:
${scopeSectionJson}

Return JSON with:
- components: array of { name, type, description, interfaceStub?, dependsOn }
- reasoning: how you derived these components
`.trim(),
  tests: [
    {
      description: 'Produces at least two components with types',
      input: {
        intentBriefJson: JSON.stringify({
          title: 'Task Manager',
          goals: [{ id: 'g1', description: 'Create and assign tasks', priority: 'must_have', acceptanceCriteria: [] }],
          targetUsers: [{ id: 'u1', persona: 'Team Lead', description: '', needs: [], painPoints: [] }],
        }),
        lockedDecisionsSectionJson: JSON.stringify({ decisions: [] }),
        scopeSectionJson: JSON.stringify({ inScope: ['Task creation', 'Task assignment'], outOfScope: [] }),
      },
      assertions: [
        (output: z.infer<typeof OutputSchema>) => output.components.length >= 2,
        (output: z.infer<typeof OutputSchema>) => output.components.every((c) => c.name.length > 0 && c.type.length > 0),
      ],
    },
  ],
});

registerPrompt(componentSpecificationsPrompt);
