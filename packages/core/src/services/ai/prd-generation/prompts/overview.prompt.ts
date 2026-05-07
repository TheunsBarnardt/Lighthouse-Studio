/**
 * Overview prompt — PRD section 1 of 10.
 *
 * Generates the executive summary, background, problem statement, proposed
 * solution, and key benefits from an approved IntentBrief.
 */

import type { AiGenerationPort } from '@platform/ports-ai';

import type { IntentBrief } from '../../intent-capture/types.js';
import type { PromptDefinition } from '../../types.js';
import type { OverviewContent } from '../types.js';

import { definePrompt } from '../../define-prompt.js';
import { OverviewContentSchema } from '../types.js';

// ── Input ─────────────────────────────────────────────────────────────────────

interface OverviewInput {
  intentBrief: IntentBrief;
  templateHints?: string;
}

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a senior product manager with 15 years of experience writing high-quality Product Requirements Documents for enterprise software. Your job is to write the Overview section of a PRD from an approved Intent Brief.

The Overview section must contain:
- summary: A single, compelling paragraph (3-5 sentences) that a busy executive can read in 30 seconds to understand what is being built and why.
- background: 1-2 paragraphs explaining the business context, market forces, or internal needs that motivated this project. Cite any relevant history or prior attempts if present in the intent brief.
- problemStatement: A crisp, specific statement of the core problem. Avoid vague phrases like "improve efficiency". Instead name the root cause and its cost to the business or user.
- proposedSolution: What will be built, at a high level. Focus on the approach and key differentiators, not implementation details.
- keyBenefits: An array of 3-6 concise, outcome-focused benefit statements. Each should be measurable or at least observable. Start each benefit with a verb (e.g., "Reduces manual data entry by...").

Quality rules:
- Every field must derive from or be traceable to the intent brief. Do not invent goals or constraints not present in the intent.
- Avoid marketing language and superlatives. Be specific.
- Do not repeat the same point across fields. Each field has a distinct purpose.
- Output strictly valid JSON matching the schema. No markdown wrappers, no prose outside JSON.

Anti-patterns to avoid:
- Writing a problem statement that is really a solution description.
- Listing benefits that are features ("has a dashboard") rather than outcomes ("enables managers to see status without asking").
- A summary that is just a repetition of the title.`;

// ── Factory ───────────────────────────────────────────────────────────────────

export function createOverviewPrompt(
  ai: AiGenerationPort,
): PromptDefinition<OverviewInput, OverviewContent> {
  return definePrompt(ai, {
    id: 'prd.overview',
    version: '1.0.0',
    description: 'Generate the Overview section of a PRD from an approved Intent Brief.',
    estimatedCostRange: { minUsd: 0.05, maxUsd: 0.2 },
    systemPrompt: SYSTEM_PROMPT,
    buildMessages: (input) => [
      {
        role: 'user',
        content: [
          'Generate the Overview section for this project.',
          '',
          '## Intent Brief',
          '```json',
          JSON.stringify(input.intentBrief, null, 2),
          '```',
          ...(input.templateHints ? ['', '## Template Hints', input.templateHints] : []),
          '',
          'Return a JSON object matching this schema:',
          '{ summary: string, background: string, problemStatement: string, proposedSolution: string, keyBenefits: string[] }',
        ].join('\n'),
      },
    ],
    outputSchema: OverviewContentSchema,
    defaults: { model: 'claude-3-5-sonnet-20241022', maxTokens: 2000 },
  });
}
