import type { StageName } from '@platform/ports-ai';
import type { ZodType } from 'zod';

// ── Reasoning schema ───────────────────────────────────────────────────────────
import { z } from 'zod';

export const ReasoningSchema = z.object({
  rationale: z.string().min(1),
  alternatives_considered: z.array(z.string()),
  assumptions: z.array(z.string()),
  uncertainties: z.array(z.string()),
  source_artifacts: z.array(z.string()),
});

export type ReasoningOutput = z.infer<typeof ReasoningSchema>;

// ── Token budget ───────────────────────────────────────────────────────────────

export interface TokenBudget {
  /** Expected average input tokens per call on golden inputs. */
  inputTokens: number;
  /** Expected average output tokens per call on golden inputs. */
  outputTokens: number;
}

// ── Model config ───────────────────────────────────────────────────────────────

export interface PromptModelConfig {
  /** Provider id (e.g. 'anthropic'). Workspace config can override. */
  provider: string;
  model: string;
  /** Temperatures > 0.5 require explicit justification comment above this field. */
  temperature: number;
  maxTokens: number;
}

// ── Test assertions ────────────────────────────────────────────────────────────

export type PromptTestAssertion =
  | { type: 'output_matches_schema' }
  | { type: 'contains_field'; field: string }
  | { type: 'field_equals'; field: string; value: unknown }
  | { type: 'array_not_empty'; field: string }
  | { type: 'custom'; check: (output: unknown) => boolean; description: string };

export interface PromptTestCase<TInput> {
  name: string;
  input: TInput;
  assertions: PromptTestAssertion[];
}

// ── definePrompt ───────────────────────────────────────────────────────────────

export interface PromptDefinition<TInput, TOutput> {
  id: string;
  version: string;
  stage: StageName;
  description: string;
  inputs: ZodType<TInput>;
  outputs: ZodType<TOutput>;
  modelConfig: PromptModelConfig;
  systemPrompt: string;
  userPromptTemplate: (inputs: TInput) => string;
  tokenBudget: TokenBudget;
  /** Tool ids this prompt may use. Leave empty for read-only prompts. */
  tools?: string[];
  /** Whether to cache responses. Set false for creative/high-temperature prompts. */
  cacheable?: boolean;
  /** For temperature: 0 prompts, tolerance for structural variance in CI determinism checks. */
  varianceTolerance?: number;
  examples?: Array<{ input: Partial<TInput>; description: string }>;
  tests?: Array<PromptTestCase<TInput>>;
}

/**
 * Defines a prompt as a typed, versioned, testable artifact.
 * Prompts live in packages/core/src/ai/prompts/<stage>/<name>.prompt.ts.
 */
export function definePrompt<TInput, TOutput>(
  definition: PromptDefinition<TInput, TOutput>,
): PromptDefinition<TInput, TOutput> {
  if (definition.modelConfig.temperature > 0.5) {
    // The CI lint rule will enforce a justification comment at the call site.
    // This runtime check is a belt-and-suspenders guard.
    throw new Error(
      `Prompt "${definition.id}" has temperature ${String(definition.modelConfig.temperature)} > 0.5. ` +
        'Add a justification comment and set a per-prompt variance tolerance.',
    );
  }
  return definition;
}
