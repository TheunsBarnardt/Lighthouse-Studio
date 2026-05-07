/**
 * Non-Functional Requirements prompt — PRD section 6 of 10.
 *
 * Defines measurable NFRs across performance, security, scalability, usability,
 * accessibility, reliability, maintainability, and portability categories.
 * Derives constraints from the intent brief and the functional requirements.
 */

import type { AiGenerationPort } from '@platform/ports-ai';
import type { z } from 'zod';

import type { IntentBrief } from '../../intent-capture/types.js';
import type { PromptDefinition } from '../../types.js';
import type { FunctionalRequirementsContent, NonFunctionalRequirementsContent } from '../types.js';

import { definePrompt } from '../../define-prompt.js';
import { NonFunctionalRequirementsContentSchema } from '../types.js';

// ── Input ─────────────────────────────────────────────────────────────────────

interface NonFunctionalRequirementsInput {
  intentBrief: IntentBrief;
  functionalRequirements: FunctionalRequirementsContent;
  templateHints?: string;
}

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a solutions architect with extensive experience defining non-functional requirements (NFRs) for enterprise software systems. You understand how to translate business context and functional scope into measurable quality attributes.

Your task is to write the Non-Functional Requirements section of a PRD. You will receive an approved Intent Brief and the completed Functional Requirements section.

Each NonFunctionalRequirement must:
- id: Sequential identifier "NFR-1", "NFR-2", etc.
- category: One of: "performance" | "security" | "scalability" | "usability" | "accessibility" | "reliability" | "maintainability" | "portability".
- title: A noun phrase naming the quality attribute (e.g., "Page Load Performance", "Role-Based Access Control").
- description: 2-3 sentences describing the quality requirement in the context of this specific system.
- acceptanceCriteria: An array of at least 1 MetricAcceptanceCriterion per NFR. Each has:
  - id: "NFR-<N>-AC-<M>" format.
  - metric: What is being measured (e.g., "API response time at p95", "WCAG conformance level").
  - threshold: The target value or range (e.g., "< 500ms", "WCAG 2.1 AA", "99.9% uptime monthly").
  - measurement: How it will be measured (e.g., "load testing with k6 at 100 concurrent users", "axe-core automated scan + manual expert review").
- tracesTo: Refs linking to relevant FRs or intent constraints. Use type "requirement" with artifactId = pipelineId and fieldPath = "constraints.<constraint-id>" for constraint-derived NFRs, or type "prd_section" for FR-derived ones.

Coverage rules:
- Must include at least one NFR per applicable category. For most projects: performance, security, and accessibility are always applicable.
- Derive NFRs from: intent brief constraints, project type (e.g., e-commerce always needs payment security), and the nature of the FRs.
- Every technical constraint in the intent brief must produce at least one NFR.

Quality rules:
- Thresholds must be specific and measurable — not "fast" or "secure".
- Accessibility NFR must reference WCAG 2.1 AA as the baseline minimum.
- Security NFR must address authentication and authorisation if user accounts exist in the FRs.
- Do not duplicate functional requirements as NFRs.
- Output strictly valid JSON. No prose outside the JSON object.

Anti-patterns to avoid:
- NFRs with threshold "TBD" — estimate based on project type and scale.
- Conflating scalability (capacity) with performance (latency).
- Usability NFRs that describe UI features rather than measurable task success rates.`;

// ── Factory ───────────────────────────────────────────────────────────────────

export function createNonFunctionalRequirementsPrompt(
  ai: AiGenerationPort,
): PromptDefinition<NonFunctionalRequirementsInput, NonFunctionalRequirementsContent> {
  return definePrompt(ai, {
    id: 'prd.non_functional_requirements',
    version: '1.0.0',
    description:
      'Generate the Non-Functional Requirements section of a PRD with metric-based acceptance criteria across quality attribute categories.',
    estimatedCostRange: { minUsd: 0.08, maxUsd: 0.35 },
    systemPrompt: SYSTEM_PROMPT,
    buildMessages: (input) => [
      {
        role: 'user',
        content: [
          'Generate the Non-Functional Requirements section for this project.',
          '',
          '## Intent Brief',
          '```json',
          JSON.stringify(input.intentBrief, null, 2),
          '```',
          '',
          '## Functional Requirements (already written)',
          '```json',
          JSON.stringify(input.functionalRequirements, null, 2),
          '```',
          ...(input.templateHints ? ['', '## Template Hints', input.templateHints] : []),
          '',
          'Return a JSON object: { requirements: NonFunctionalRequirement[] }',
          'Each NFR: { id, category, title, description, acceptanceCriteria: [{ id, metric, threshold, measurement? }], tracesTo: [{ type, artifactId, fieldPath }] }',
        ].join('\n'),
      },
    ],
    outputSchema:
      NonFunctionalRequirementsContentSchema as z.ZodType<NonFunctionalRequirementsContent>,
    defaults: { model: 'claude-3-5-sonnet-20241022', maxTokens: 5000 },
  });
}
