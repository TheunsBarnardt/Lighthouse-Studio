import type { JsonSchema } from '@platform/ports-ai';
import type { RequestContext } from '@platform/ports-authorization';
import type { Result } from 'neverthrow';
import type { ZodType } from 'zod';

import type { AppError } from '../errors.js';

// ── Tool definition ────────────────────────────────────────────────────────────

export interface ToolDefinitionFull<TParams, TReturn> {
  id: string;
  name: string;
  description: string;
  parameters: ZodType<TParams>;
  returns: ZodType<TReturn>;
  /**
   * Permissions the calling user must hold for the tool to execute.
   * The ToolRegistry verifies these before calling execute().
   */
  permissions: string[];
  /**
   * Whether this tool writes to the platform (creates/updates/deletes data).
   * Write tools are excluded from prompts by default; stages must explicitly opt in.
   */
  writesToPlatform: boolean;
  execute(ctx: RequestContext, params: TParams): Promise<Result<TReturn, AppError>>;
}

/**
 * Defines a typed, audited, permission-checked AI tool.
 * Tools live in packages/core/src/ai/tools/<name>.tool.ts.
 *
 * The ToolRegistry handles:
 *   1. Verifying caller permissions before execute() is called
 *   2. Auditing every call (tool id, params, result, duration)
 *   3. Converting the parameter schema to provider-specific format
 *
 * Do NOT add audit calls inside execute() — the registry handles that.
 */
export function defineTool<TParams, TReturn>(
  definition: ToolDefinitionFull<TParams, TReturn>,
): ToolDefinitionFull<TParams, TReturn> {
  return definition;
}

/**
 * Convert a Zod schema to a JSON Schema object suitable for provider tool definitions.
 * Minimal implementation — handles object schemas with scalar properties.
 */
export function zodToJsonSchema(schema: ZodType): JsonSchema {
  // Use zod-to-json-schema if available; otherwise produce a minimal schema.
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { zodToJsonSchema: convert } = require('zod-to-json-schema') as {
      zodToJsonSchema: (s: ZodType) => JsonSchema;
    };
    return convert(schema);
  } catch {
    return schema.description !== undefined
      ? { type: 'object', description: schema.description }
      : { type: 'object' };
  }
}
