import type { ToolDefinition } from '@platform/ports-ai-provider';
import type { RequestContext } from '@platform/ports-authorization';
import type { Result } from 'neverthrow';

import { err } from 'neverthrow';

import type { AppError } from '../errors.js';
import type { PlatformToolDefinition } from './define-tool.js';

import { NotFoundError } from '../errors.js';
import { toProviderToolDefinition } from './define-tool.js';

export interface ToolCallResult {
  toolUseId: string;
  result?: unknown;
  error?: string;
}

export class ToolRegistry {
  private readonly tools = new Map<string, PlatformToolDefinition>();

  register(tool: PlatformToolDefinition): void {
    this.tools.set(tool.id, tool);
  }

  registerMany(tools: PlatformToolDefinition[]): void {
    for (const tool of tools) this.register(tool);
  }

  getProviderDefinitions(ids?: string[]): ToolDefinition[] {
    const source = ids
      ? ids.map((id) => this.tools.get(id)).filter(Boolean)
      : Array.from(this.tools.values());
    return (source as PlatformToolDefinition[]).map(toProviderToolDefinition);
  }

  async execute(
    ctx: RequestContext,
    toolName: string,
    input: unknown,
  ): Promise<Result<unknown, AppError>> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      return err(new NotFoundError('tool', toolName));
    }

    const parsed = tool.parameters.safeParse(input);
    if (!parsed.success) {
      return err(
        new (await import('../errors.js').then((m) => m.ValidationError))(
          `Invalid parameters for tool '${toolName}': ${parsed.error.message}`,
        ),
      );
    }

    return tool.execute(ctx, parsed.data);
  }
}
