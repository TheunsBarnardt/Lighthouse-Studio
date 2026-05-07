/**
 * Orchestrator prompt — auxiliary prompt 5 of 5.
 *
 * A thin meta-prompt that produces a planning summary for logging at the start
 * of a full PRD generation run. Does not generate any PRD content itself.
 */

import type { AiGenerationPort } from '@platform/ports-ai';

import { z } from 'zod';

import type { IntentBrief } from '../../intent-capture/types.js';
import type { PromptDefinition } from '../../types.js';

import { definePrompt } from '../../define-prompt.js';

// ── Output schema ─────────────────────────────────────────────────────────────

const OrchestratorPlanSchema = z.object({
  planSummary: z.string().min(1),
  estimatedSections: z.number().int().positive(),
  templateApplied: z.boolean(),
});

type OrchestratorPlan = z.infer<typeof OrchestratorPlanSchema>;

// ── Input ─────────────────────────────────────────────────────────────────────

interface OrchestratorInput {
  intentBrief: IntentBrief;
  templateId?: string;
}

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a PRD generation orchestrator. Your sole responsibility is to produce a brief planning summary that describes what will be generated in a full PRD generation run.

You will receive an Intent Brief and an optional template ID.

Produce:
- planSummary: A 2-4 sentence description of the PRD generation plan. Include: the project title, the number of sections to generate, the key areas of focus based on the intent (e.g., "heavy emphasis on security requirements given the regulatory constraints"), and any template-specific adjustments.
- estimatedSections: Always 10 (all standard PRD sections will be generated unless the caller overrides).
- templateApplied: true if a templateId was provided, false otherwise.

Keep the planSummary concise and informative. It is used for logging and audit trails, not for user display.

Output strictly valid JSON: { planSummary: string, estimatedSections: number, templateApplied: boolean }
No prose outside the JSON object.`;

// ── Factory ───────────────────────────────────────────────────────────────────

export function createOrchestratorPrompt(
  ai: AiGenerationPort,
): PromptDefinition<OrchestratorInput, OrchestratorPlan> {
  return definePrompt(ai, {
    id: 'prd.orchestrator',
    version: '1.0.0',
    description:
      'Produce a planning summary for a full PRD generation run. Used for logging and audit trails.',
    estimatedCostRange: { minUsd: 0.01, maxUsd: 0.05 },
    systemPrompt: SYSTEM_PROMPT,
    buildMessages: (input) => [
      {
        role: 'user',
        content: [
          'Produce a PRD generation plan for this intent brief.',
          '',
          '## Intent Brief',
          '```json',
          JSON.stringify(input.intentBrief, null, 2),
          '```',
          ...(input.templateId ? [`\n## Template ID\n${input.templateId}`] : []),
          '',
          'Return a JSON object: { planSummary: string, estimatedSections: number, templateApplied: boolean }',
        ].join('\n'),
      },
    ],
    outputSchema: OrchestratorPlanSchema,
    defaults: { model: 'claude-3-5-sonnet-20241022', maxTokens: 500 },
  });
}
