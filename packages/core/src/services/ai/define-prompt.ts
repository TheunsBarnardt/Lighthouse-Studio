/**
 * definePrompt — Objective 20 prompt registration API.
 *
 * Wraps a prompt configuration into a typed, versioned PromptDefinition.
 * Every prompt in the AI pipeline is registered with this function.
 */

import type { AiGenerationPort, AiMessage } from '@platform/ports-ai';
import type { z } from 'zod';

import type {
  GenerationOptions,
  PromptDefinition,
  PromptResult,
  ReasoningRecord,
} from './types.js';

export interface PromptConfig<TInput, TOutput> {
  id: string;
  version: string;
  description: string;
  estimatedCostRange: { minUsd: number; maxUsd: number };
  /** System prompt sent as the model's instructions. */
  systemPrompt: string;
  /** Build the user-turn messages from the typed input. */
  buildMessages: (input: TInput) => AiMessage[];
  /** Zod schema to validate and parse the model's JSON output. */
  outputSchema: z.ZodType<TOutput>;
  /** Optional transform after schema validation. */
  transform?: (validated: TOutput) => TOutput;
  /** Default generation options for this prompt. */
  defaults?: Pick<GenerationOptions, 'model' | 'maxTokens' | 'temperature'>;
}

export function definePrompt<TInput, TOutput>(
  ai: AiGenerationPort,
  config: PromptConfig<TInput, TOutput>,
): PromptDefinition<TInput, TOutput> {
  async function run(input: TInput, options?: GenerationOptions): Promise<PromptResult<TOutput>> {
    const messages = config.buildMessages(input);
    const maxRetries = options?.maxRetries ?? 2;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const resolvedModel = options?.model ?? config.defaults?.model;
      const resolvedMaxTokens = options?.maxTokens ?? config.defaults?.maxTokens;
      const resolvedTemperature = options?.temperature ?? config.defaults?.temperature;
      const result = await ai.generate(messages, {
        systemPrompt: config.systemPrompt,
        ...(resolvedModel !== undefined ? { model: resolvedModel } : {}),
        ...(resolvedMaxTokens !== undefined ? { maxTokens: resolvedMaxTokens } : {}),
        ...(resolvedTemperature !== undefined ? { temperature: resolvedTemperature } : {}),
      });

      if (result.isErr()) {
        lastError = new Error(result.error.message);
        continue;
      }

      const raw = result.value;
      let parsed: unknown;

      try {
        parsed = extractJson(raw.content);
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e));
        if (attempt < maxRetries) continue;
        break;
      }

      const validated = config.outputSchema.safeParse(parsed);
      if (!validated.success) {
        lastError = new Error(
          `Schema validation failed: ${validated.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
        );
        if (attempt < maxRetries) continue;
        break;
      }

      const output = config.transform ? config.transform(validated.data) : validated.data;

      const now = new Date();
      const costUsd = estimateCost(raw.usage.inputTokens, raw.usage.outputTokens, raw.model);

      const reasoning: ReasoningRecord = {
        summary: raw.reasoning ?? 'No extended reasoning captured.',
        steps: raw.reasoning ? splitReasoningIntoSteps(raw.reasoning) : [],
        model: raw.model,
        inputTokens: raw.usage.inputTokens,
        outputTokens: raw.usage.outputTokens,
        costUsd,
        generatedAt: now,
        provider: detectProvider(raw.model),
      };

      return { output, reasoning, rawContent: raw.content };
    }

    throw (
      lastError ?? new Error(`Prompt ${config.id} failed after ${maxRetries.toString()} retries`)
    );
  }

  return {
    id: config.id,
    version: config.version,
    description: config.description,
    estimatedCostRange: config.estimatedCostRange,
    run,
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function extractJson(content: string): unknown {
  // Try direct parse first
  try {
    return JSON.parse(content);
  } catch {
    // Try to extract JSON from markdown code block
    const match = content.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
    if (match?.[1]) {
      return JSON.parse(match[1]);
    }
    // Try to find a top-level object/array
    const objMatch = content.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (objMatch?.[1]) {
      return JSON.parse(objMatch[1]);
    }
    throw new Error('Could not extract JSON from model response');
  }
}

function splitReasoningIntoSteps(reasoning: string): string[] {
  return reasoning
    .split(/\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Rough cost estimate; replace with provider-specific pricing if needed. */
function estimateCost(inputTokens: number, outputTokens: number, model: string): number {
  // Claude 3.5 Sonnet approximate pricing
  if (model.includes('sonnet')) {
    return (inputTokens * 3 + outputTokens * 15) / 1_000_000;
  }
  // Claude 3 Haiku
  if (model.includes('haiku')) {
    return (inputTokens * 0.25 + outputTokens * 1.25) / 1_000_000;
  }
  // GPT-4o
  if (model.includes('gpt-4o')) {
    return (inputTokens * 5 + outputTokens * 15) / 1_000_000;
  }
  // Default fallback
  return (inputTokens * 3 + outputTokens * 15) / 1_000_000;
}

function detectProvider(model: string): string {
  if (model.startsWith('claude')) return 'anthropic';
  if (model.startsWith('gpt') || model.startsWith('o1')) return 'openai';
  return 'unknown';
}
