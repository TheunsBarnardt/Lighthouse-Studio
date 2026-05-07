/**
 * Goals and Success Metrics prompt — PRD section 2 of 10.
 *
 * Converts each IntentGoal into a measurable GoalEntry with a SMART success
 * metric and measurement method. Populates tracesTo references back to the
 * intent brief.
 */

import type { AiGenerationPort } from '@platform/ports-ai';

import type { IntentBrief } from '../../intent-capture/types.js';
import type { PromptDefinition } from '../../types.js';
import type { GoalsAndSuccessMetricsContent, OverviewContent } from '../types.js';

import { definePrompt } from '../../define-prompt.js';
import { GoalsAndSuccessMetricsContentSchema } from '../types.js';

// ── Input ─────────────────────────────────────────────────────────────────────

interface GoalsSuccessMetricsInput {
  intentBrief: IntentBrief;
  overview: OverviewContent;
  templateHints?: string;
}

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a senior product manager skilled in defining SMART (Specific, Measurable, Achievable, Relevant, Time-bound) goals and measurable success metrics for software products.

Your task is to produce the Goals and Success Metrics section of a PRD. You will receive an approved Intent Brief (with its goals array) and the already-written Overview section.

Each GoalEntry must:
- Use the same id as the corresponding IntentGoal (e.g., "goal-1"). Preserve all existing goal IDs.
- Carry the same priority as the IntentGoal.
- successMetric: A single, quantified or binary outcome that proves the goal was achieved. Use numbers where possible (e.g., "95% of users can complete task X in under 2 minutes").
- measurementMethod: How the metric will be measured — specify tool, data source, or method (e.g., "analytics event tracking via Mixpanel", "quarterly NPS survey", "automated load test at 500 concurrent users").
- tracesTo: An array containing at least one ref with type "intent_brief", artifactId set to the intent brief's pipelineId, and fieldPath set to "goals.<goal-id>" (e.g., "goals.goal-1").
- overallSuccessCriteria: A paragraph summarising what "done and successful" looks like for the whole initiative, synthesising all must/should goals.

Quality rules:
- Every IntentGoal must produce exactly one GoalEntry. Do not skip or add goals.
- "Nice-to-have" goals still need measurable metrics — just scope them appropriately.
- Avoid circular metrics ("success is when users are successful"). Be specific.
- Do not invent goals that are not in the intent brief.
- Output strictly valid JSON. No prose outside the JSON object.

Anti-patterns to avoid:
- Vague successMetric like "user satisfaction improves" — add a threshold and measurement period.
- measurementMethod of "TBD" — always specify a concrete method even if approximate.
- Missing tracesTo — every goal must link back to the intent brief.`;

// ── Factory ───────────────────────────────────────────────────────────────────

export function createGoalsSuccessMetricsPrompt(
  ai: AiGenerationPort,
): PromptDefinition<GoalsSuccessMetricsInput, GoalsAndSuccessMetricsContent> {
  return definePrompt(ai, {
    id: 'prd.goals_and_success_metrics',
    version: '1.0.0',
    description:
      'Generate the Goals and Success Metrics section of a PRD, creating one measurable GoalEntry per IntentGoal.',
    estimatedCostRange: { minUsd: 0.05, maxUsd: 0.25 },
    systemPrompt: SYSTEM_PROMPT,
    buildMessages: (input) => [
      {
        role: 'user',
        content: [
          'Generate the Goals and Success Metrics section for this project.',
          '',
          '## Intent Brief',
          '```json',
          JSON.stringify(input.intentBrief, null, 2),
          '```',
          '',
          '## Overview (already written)',
          '```json',
          JSON.stringify(input.overview, null, 2),
          '```',
          ...(input.templateHints ? ['', '## Template Hints', input.templateHints] : []),
          '',
          'Return a JSON object: { goals: GoalEntry[], overallSuccessCriteria: string }',
          'Each GoalEntry: { id, description, priority, successMetric, measurementMethod, tracesTo: [{ type, artifactId, fieldPath }] }',
        ].join('\n'),
      },
    ],
    outputSchema: GoalsAndSuccessMetricsContentSchema,
    defaults: { model: 'claude-3-5-sonnet-20241022', maxTokens: 3000 },
  });
}
