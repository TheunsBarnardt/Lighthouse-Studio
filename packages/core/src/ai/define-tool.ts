import type { JsonSchema, ToolDefinition } from '@platform/ports-ai-provider';
import type { RequestContext } from '@platform/ports-authorization';
import type { Result } from 'neverthrow';
import type { ZodSchema } from 'zod';

import type { AppError } from '../errors.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PlatformToolDefinition<TParams = unknown, TResult = unknown> {
  id: string;
  name: string;
  description: string;
  parameters: ZodSchema<TParams>;
  returns: ZodSchema<TResult>;
  permissions: string[];
  execute(ctx: RequestContext, params: TParams): Promise<Result<TResult, AppError>>;
}

// ── Factory ───────────────────────────────────────────────────────────────────

export function defineTool<TParams, TResult>(
  config: PlatformToolDefinition<TParams, TResult>,
): PlatformToolDefinition<TParams, TResult> {
  return config;
}

// ── Convert platform tool to provider ToolDefinition ─────────────────────────

export function toProviderToolDefinition(tool: PlatformToolDefinition): ToolDefinition {
  return {
    id: tool.id,
    name: tool.name,
    description: tool.description,
    inputSchema: zodToJsonSchema(tool.parameters),
  };
}

// ── Simple zod → JSON schema converter (handles common cases) ─────────────────

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
function zodToJsonSchema(schema: ZodSchema): JsonSchema {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const def = (schema as any)._def;
  if (!def) return { type: 'object' };

  switch (def.typeName) {
    case 'ZodObject': {
      const shape = def.shape();
      const properties: Record<string, JsonSchema> = {};
      const required: string[] = [];
      for (const [key, val] of Object.entries(shape)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fieldDef = (val as any)._def;
        const isOptional = fieldDef?.typeName === 'ZodOptional';
        properties[key] = zodToJsonSchema(isOptional ? fieldDef.innerType : (val as ZodSchema));
        if (!isOptional) required.push(key);
      }
      return { type: 'object', properties, required };
    }
    case 'ZodString':
      return { type: 'string', description: def.description };
    case 'ZodNumber':
      return { type: 'number' };
    case 'ZodBoolean':
      return { type: 'boolean' };
    case 'ZodArray':
      return { type: 'array', items: zodToJsonSchema(def.type) };
    case 'ZodEnum':
      return { type: 'string', enum: def.values };
    case 'ZodOptional':
      return zodToJsonSchema(def.innerType);
    default:
      return { type: 'string' };
  }
}
/* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
