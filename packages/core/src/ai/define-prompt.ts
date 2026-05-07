import type { ModelConfig } from '@platform/ports-ai-provider';
import type { ZodSchema } from 'zod';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PromptExample<TIn = unknown> {
  description?: string;
  input: TIn;
}

export type PromptAssertionType =
  | 'output_matches_schema'
  | 'contains_field'
  | 'field_equals'
  | 'field_not_empty'
  | 'output_field_matches'
  | 'output_field_min_items'
  | 'output_field_includes_name'
  | 'output_present'
  | 'output_contains'
  | 'output_range'
  | 'output_value'
  | 'custom'
  | 'output-contains'
  | 'output-valid-schema'
  | 'output-contains-string';

export interface PromptAssertion {
  type?: PromptAssertionType;
  field?: string;
  path?: string;
  expected?: unknown;
  value?: unknown;
  equals?: unknown;
  oneOf?: unknown[];
  count?: number;
  minItems?: number;
  min?: number;
  max?: number;
  gte?: number;
  contains?: unknown;
  message?: string;
  check?: (output: unknown) => boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PromptAssertionFn = (output: any) => boolean;

export interface PromptTest<TIn = unknown> {
  name?: string;
  description?: string;
  input: TIn;
  assertions: Array<PromptAssertion | PromptAssertionFn>;
}

export interface PromptDefinition<TIn = unknown, TOut = unknown> {
  id: string;
  version: string;
  description: string;
  inputs: ZodSchema<TIn>;
  outputs: ZodSchema<TOut>;
  modelConfig: ModelConfig;
  systemPrompt: string;
  /** Accepts a plain string (for prompts that don't interpolate inputs) or a function. */
  userPromptTemplate: string | ((inputs: TIn) => string);
  examples?: PromptExample<TIn>[];
  tests?: PromptTest<TIn>[];
}

export type InferPromptInput<T> = T extends PromptDefinition<infer TIn> ? TIn : never;
export type InferPromptOutput<T> = T extends PromptDefinition<unknown, infer TOut> ? TOut : never;

// ── ReasoningSchema — required in every prompt output ─────────────────────────

export const ReasoningSchema = {
  type: 'object' as const,
  properties: {
    rationale: { type: 'string' as const },
    alternativesConsidered: { type: 'array' as const, items: { type: 'string' as const } },
    assumptions: { type: 'array' as const, items: { type: 'string' as const } },
    uncertainties: { type: 'array' as const, items: { type: 'string' as const } },
  },
  required: ['rationale', 'alternativesConsidered', 'assumptions', 'uncertainties'],
};

// ── Factory ───────────────────────────────────────────────────────────────────

export function definePrompt<TIn, TOut>(
  config: PromptDefinition<TIn, TOut>,
): PromptDefinition<TIn, TOut> {
  return config;
}

// ── Prompt registry (in-memory; populated at startup) ────────────────────────

const registry = new Map<string, PromptDefinition>();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function registerPrompt(prompt: PromptDefinition<any, any>): void {
  registry.set(prompt.id, prompt);
}

export function getPrompt(id: string): PromptDefinition | undefined {
  return registry.get(id);
}

export function getAllPrompts(): PromptDefinition[] {
  return Array.from(registry.values());
}
