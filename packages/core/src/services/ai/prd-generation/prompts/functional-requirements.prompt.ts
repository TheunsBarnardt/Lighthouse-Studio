/**
 * Functional Requirements prompt — PRD section 5 of 10.
 *
 * Converts user stories into numbered, testable functional requirements (FR-1,
 * FR-2, …). Every FR must have at least one Gherkin-style acceptance criterion
 * and must trace back to at least one intent goal.
 */

import type { AiGenerationPort } from '@platform/ports-ai';
import type { z } from 'zod';

import type { IntentBrief } from '../../intent-capture/types.js';
import type { PromptDefinition } from '../../types.js';
import type {
  FunctionalRequirementsContent,
  GoalsAndSuccessMetricsContent,
  UserStoriesContent,
} from '../types.js';

import { definePrompt } from '../../define-prompt.js';
import { FunctionalRequirementsContentSchema } from '../types.js';

// ── Input ─────────────────────────────────────────────────────────────────────

interface FunctionalRequirementsInput {
  intentBrief: IntentBrief;
  userStories: UserStoriesContent;
  goals: GoalsAndSuccessMetricsContent;
  templateHints?: string;
}

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a senior business analyst and solutions architect specialising in converting agile user stories into precise, testable functional requirements for enterprise software.

Your task is to write the Functional Requirements section of a PRD. You will receive an approved Intent Brief, the User Stories section, and the Goals and Success Metrics section.

Each FunctionalRequirement must:
- id: Sequential identifier "FR-1", "FR-2", etc. — unique across the entire section.
- title: A noun phrase naming the capability (e.g., "User Authentication via Email and Password").
- description: 2-4 sentences describing exactly what the system must do. Use "The system shall..." language. Be specific about actors, data, and outcomes.
- priority: "must" | "should" | "could" | "wont" — inherit from the highest-priority story that drives this FR, or from the relevant goal priority.
- acceptanceCriteria: An array of at least 1 criterion. Each has:
  - id: "FR-<N>-AC-<M>" format (e.g., "FR-1-AC-1") — unique across the section.
  - given: System or data precondition.
  - when: The triggering action or event.
  - then: The verifiable system response or state change.
- tracesTo: At least one ref with type "intent_brief", artifactId set to the pipelineId, and fieldPath "goals.<goal-id>" for the most relevant intent goal.
- relatedStories: Array of user story IDs (e.g., ["US-1", "US-3"]) that this FR satisfies.

Coverage rules:
- Every inScope item from the intent brief must have at least one FR.
- Every "must"-priority user story must be covered by at least one FR.
- Aim for 1 FR per distinct system capability. Do not duplicate capabilities across FRs.
- Total FR count: minimum 5, target coverage of all in-scope items.

Quality rules:
- FRs describe WHAT the system does, not HOW it does it (no implementation details).
- Each acceptance criterion must be individually testable by a QA engineer.
- "then" clauses must describe observable system behaviour — not internal state.
- Use consistent terminology across all FRs (pick one term per concept and stick to it).
- Output strictly valid JSON. No prose outside the JSON object.

Anti-patterns to avoid:
- FRs that describe UI layout or visual design.
- Acceptance criteria that use "should" — they must use definitive language ("the system displays...", "the user receives...").
- Empty relatedStories arrays — every FR must link to at least one user story.
- FR descriptions containing "etc." or open-ended lists.`;

// ── Factory ───────────────────────────────────────────────────────────────────

export function createFunctionalRequirementsPrompt(
  ai: AiGenerationPort,
): PromptDefinition<FunctionalRequirementsInput, FunctionalRequirementsContent> {
  return definePrompt(ai, {
    id: 'prd.functional_requirements',
    version: '1.0.0',
    description:
      'Generate the Functional Requirements section of a PRD, converting user stories into numbered FRs with Gherkin acceptance criteria.',
    estimatedCostRange: { minUsd: 0.1, maxUsd: 0.5 },
    systemPrompt: SYSTEM_PROMPT,
    buildMessages: (input) => [
      {
        role: 'user',
        content: [
          'Generate the Functional Requirements section for this project.',
          '',
          '## Intent Brief',
          '```json',
          JSON.stringify(input.intentBrief, null, 2),
          '```',
          '',
          '## User Stories (already written)',
          '```json',
          JSON.stringify(input.userStories, null, 2),
          '```',
          '',
          '## Goals and Success Metrics (already written)',
          '```json',
          JSON.stringify(input.goals, null, 2),
          '```',
          ...(input.templateHints ? ['', '## Template Hints', input.templateHints] : []),
          '',
          'Return a JSON object: { requirements: FunctionalRequirement[] }',
          'Each FunctionalRequirement: { id, title, description, priority, acceptanceCriteria: [{ id, given, when, then }], tracesTo: [{ type, artifactId, fieldPath }], relatedStories?: string[] }',
        ].join('\n'),
      },
    ],
    // Cast needed: Zod infers a structurally identical but nominally distinct type
    // compared to the FunctionalRequirementsContent interface declaration.
    outputSchema: FunctionalRequirementsContentSchema as z.ZodType<FunctionalRequirementsContent>,
    defaults: { model: 'claude-3-5-sonnet-20241022', maxTokens: 8000 },
  });
}
