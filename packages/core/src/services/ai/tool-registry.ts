import type { ToolDefinition } from '@platform/ports-ai';
import type { AuditPort } from '@platform/ports-audit';
import type { AuthorizationPort, RequestContext } from '@platform/ports-authorization';
import type { LoggerPort } from '@platform/ports-observability';

import { err, type Result } from 'neverthrow';

import type { ToolDefinitionFull } from '../../ai/define-tool.js';
import type { AppError } from '../../errors.js';

import { zodToJsonSchema } from '../../ai/define-tool.js';
import { AUDIT_EVENTS } from '../../compliance/audit-events.js';
import { toAuditActor } from '../../context.js';
import { AuthorizationError, NotFoundError } from '../../errors.js';

/**
 * Registry for all typed AI tools. Registered at platform startup.
 * The GenerationService consults this for provider-specific tool schemas
 * and dispatches tool calls through it during generation.
 */
export class ToolRegistry {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly tools = new Map<string, ToolDefinitionFull<any, any>>();

  constructor(
    private readonly authz: AuthorizationPort,
    private readonly audit: AuditPort,
    private readonly logger: LoggerPort,
  ) {}

  register<TParams, TReturn>(tool: ToolDefinitionFull<TParams, TReturn>): void {
    this.tools.set(tool.id, tool);
    this.logger.debug('tool.registered', { toolId: tool.id });
  }

  get(toolId: string): ToolDefinitionFull<unknown, unknown> | null {
    return this.tools.get(toolId) ?? null;
  }

  /**
   * Return all registered read-only tools as ToolDefinition for provider schemas.
   * Stages that need write tools must pass includeWrite: true.
   */
  toProviderDefinitions(opts?: { includeWrite?: boolean }): ToolDefinition[] {
    const defs: ToolDefinition[] = [];
    for (const tool of this.tools.values()) {
      if (!opts?.includeWrite && tool.writesToPlatform) continue;
      defs.push({
        id: tool.id,
        name: tool.name,
        description: tool.description,
        parameters: zodToJsonSchema(tool.parameters),
      });
    }
    return defs;
  }

  /**
   * Execute a tool call from the AI. Called by GenerationService during the
   * tool-use loop. Handles permission verification and full audit of call + result.
   */
  async executeCall(
    ctx: RequestContext,
    toolId: string,
    parameters: unknown,
  ): Promise<Result<unknown, AppError>> {
    const tool = this.tools.get(toolId);
    if (!tool) {
      return err(new NotFoundError('tool', toolId));
    }

    // 1. Verify permissions
    for (const permission of tool.permissions) {
      const authResult = await this.authz.authorize(ctx, permission, 'ai_tool');
      if (authResult.isErr()) {
        await this.audit.write({
          eventType: AUDIT_EVENTS.AI_TOOL_CALLED,
          actor: toAuditActor(ctx),
          resource: { type: 'ai_tool', id: toolId },
          action: 'called',
          outcome: 'denied',
          correlationId: ctx.correlationId,
          metadata: { toolId, permission },
        });
        return err(new AuthorizationError(`Tool ${toolId} requires permission: ${permission}`));
      }
    }

    const start = Date.now();

    // 2. Parse parameters
    const parsed = tool.parameters.safeParse(parameters);
    if (!parsed.success) {
      this.logger.warn('tool.invalid_params', { toolId, issues: parsed.error.issues });
      return err(
        new (await import('../../errors.js')).ValidationError(
          `Invalid parameters for tool ${toolId}`,
          parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        ),
      );
    }

    // 3. Execute
    let result: Result<unknown, AppError>;
    try {
      result = await tool.execute(ctx, parsed.data);
    } catch (thrown: unknown) {
      const msg = thrown instanceof Error ? thrown.message : String(thrown);
      this.logger.error('tool.execution_error', { toolId, error: msg });
      await this.audit.write({
        eventType: AUDIT_EVENTS.AI_TOOL_FAILED,
        actor: toAuditActor(ctx),
        resource: { type: 'ai_tool', id: toolId },
        action: 'failed',
        outcome: 'failure',
        correlationId: ctx.correlationId,
        metadata: { toolId, durationMs: Date.now() - start, error: msg },
      });
      return err(
        new (await import('../../errors.js')).InternalError(`Tool ${toolId} threw: ${msg}`),
      );
    }

    const durationMs = Date.now() - start;

    // 4. Audit the call outcome
    if (result.isOk()) {
      await this.audit.write({
        eventType: AUDIT_EVENTS.AI_TOOL_CALLED,
        actor: toAuditActor(ctx),
        resource: { type: 'ai_tool', id: toolId },
        action: 'called',
        outcome: 'success',
        correlationId: ctx.correlationId,
        metadata: { toolId, durationMs },
      });
    } else {
      await this.audit.write({
        eventType: AUDIT_EVENTS.AI_TOOL_FAILED,
        actor: toAuditActor(ctx),
        resource: { type: 'ai_tool', id: toolId },
        action: 'failed',
        outcome: 'failure',
        correlationId: ctx.correlationId,
        metadata: { toolId, durationMs, errorCode: result.error.code },
      });
    }

    return result;
  }
}
