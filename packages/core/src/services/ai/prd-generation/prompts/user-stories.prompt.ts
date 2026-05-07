/**
 * User Stories prompt — PRD section 4 of 10.
 *
 * Generates a comprehensive set of user stories in standard "As a / I want /
 * So that" format with Gherkin-style acceptance criteria. Depends on the
 * completed Target Users and Goals sections.
 */

import type { AiGenerationPort } from '@platform/ports-ai';
import type { z } from 'zod';

import type { IntentBrief } from '../../intent-capture/types.js';
import type { PromptDefinition } from '../../types.js';
import type {
  GoalsAndSuccessMetricsContent,
  TargetUsersContent,
  UserStoriesContent,
} from '../types.js';

import { definePrompt } from '../../define-prompt.js';
import { UserStoriesContentSchema } from '../types.js';

// ── Input ─────────────────────────────────────────────────────────────────────

interface UserStoriesInput {
  intentBrief: IntentBrief;
  targetUsers: TargetUsersContent;
  goals: GoalsAndSuccessMetricsContent;
  templateHints?: string;
}

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a senior agile business analyst with deep expertise in user story writing and acceptance criteria definition for enterprise software projects.

Your task is to write the User Stories section of a PRD. You will receive an approved Intent Brief, the completed Target Users and Personas section, and the completed Goals and Success Metrics section.

Each UserStory must:
- id: Sequential identifier "US-1", "US-2", etc.
- persona: The persona id from the Target Users section that owns this story.
- capability: What the user wants to do — a concise verb phrase.
- benefit: The outcome or value the user gains — starts with a result, not an action.
- formatted: The canonical story text "As a [persona name], I want [capability], so that [benefit]." Use the persona's name (not id) in the formatted field.
- acceptanceCriteria: An array of at least 1 criterion per story. Each criterion has:
  - id: "AC-N" where N is globally unique across all stories in this section
  - given: The precondition / system state
  - when: The user action or triggering event
  - then: The observable outcome the system produces
- priority: "must" | "should" | "could" | "wont" — aligned to the goal priorities from the Goals section.
- storyPoints: Optional effort estimate (1, 2, 3, 5, 8, 13) — omit if not determinable.
- tracesTo: At least one ref with type "intent_brief" pointing to the relevant intent goal via fieldPath "goals.<goal-id>".

Coverage rules:
- Every IntentGoal marked "must" or "should" must have at least two user stories.
- Every persona must appear in at least one story.
- Total story count: minimum 8, no fixed maximum — generate enough to cover the in-scope features.

Quality rules:
- The "formatted" field must be grammatically correct and use the persona's name.
- Acceptance criteria must be testable — avoid subjective language ("user finds it easy").
- "given" describes system/data state, not a user action. "when" is the user action.
- Stories should represent incremental user value — not technical tasks.
- Output strictly valid JSON. No prose outside the JSON object.

Anti-patterns to avoid:
- Stories that describe implementation ("The system stores data in a database").
- Acceptance criteria with "then" clauses like "the system works correctly".
- Duplicate stories that differ only in minor wording.`;

// ── Factory ───────────────────────────────────────────────────────────────────

export function createUserStoriesPrompt(
  ai: AiGenerationPort,
): PromptDefinition<UserStoriesInput, UserStoriesContent> {
  return definePrompt(ai, {
    id: 'prd.user_stories',
    version: '1.0.0',
    description:
      'Generate the User Stories section of a PRD with Given/When/Then acceptance criteria, tracing back to intent goals.',
    estimatedCostRange: { minUsd: 0.1, maxUsd: 0.5 },
    systemPrompt: SYSTEM_PROMPT,
    buildMessages: (input) => [
      {
        role: 'user',
        content: [
          'Generate the User Stories section for this project.',
          '',
          '## Intent Brief',
          '```json',
          JSON.stringify(input.intentBrief, null, 2),
          '```',
          '',
          '## Target Users and Personas (already written)',
          '```json',
          JSON.stringify(input.targetUsers, null, 2),
          '```',
          '',
          '## Goals and Success Metrics (already written)',
          '```json',
          JSON.stringify(input.goals, null, 2),
          '```',
          ...(input.templateHints ? ['', '## Template Hints', input.templateHints] : []),
          '',
          'Return a JSON object: { stories: UserStory[] }',
          'Each UserStory: { id, persona, capability, benefit, formatted, acceptanceCriteria: [{ id, given, when, then }], priority, storyPoints?, tracesTo: [{ type, artifactId, fieldPath }] }',
        ].join('\n'),
      },
    ],
    outputSchema: UserStoriesContentSchema as z.ZodType<UserStoriesContent>,
    defaults: { model: 'claude-3-5-sonnet-20241022', maxTokens: 6000 },
  });
}
