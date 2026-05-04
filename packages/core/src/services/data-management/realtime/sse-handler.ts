import type { AuditPort } from '@platform/ports-audit';
import type { AuthorizationPort, RequestContext } from '@platform/ports-authorization';
import type { LoggerPort, MetricsPort } from '@platform/ports-observability';
import type { RateLimiterPort } from '@platform/ports-rate-limiter';

import { uuidv7 } from 'uuidv7';

import type { CustomerTableDefinition } from '../schema-model.js';
import type { SchemaService } from '../schema.service.js';
import type { ConnectionManager } from './connection-manager.js';
import type { SubscriptionManager } from './subscription-manager.js';
import type { DeliverableEvent } from './types.js';

import { toAuditActor, auditMeta } from '../../../context.js';
import { REALTIME_AUDIT_EVENTS } from '../audit-events.js';
import { REALTIME_DEFAULTS } from './types.js';

// ── SSE request/response types (framework-agnostic) ───────────────────────────

/**
 * Abstract inbound SSE request.
 * The HTTP adapter (Fastify, etc.) maps its request type to this shape.
 */
export interface SseRequest {
  ctx: RequestContext;
  /** The workspace slug from the URL. */
  workspaceSlug: string;
  /** The schema slug from the URL. */
  schemaSlug: string;
  /**
   * URL query parameters.
   * Each `subscribe[<table>][filter][...]` key declares a subscription.
   */
  queryParams: Record<string, string | string[]>;
  /** Called by the framework when the client disconnects. */
  onClose: (handler: () => void) => void;
}

/**
 * Abstract outbound SSE writer.
 * The HTTP adapter calls these methods to stream events to the client.
 */
export interface SseWriter {
  writeHeaders(): void;
  writeEvent(id: string, eventType: string, data: string): void;
  writeComment(comment: string): void;
  end(): void;
}

// ── Parsed subscription declaration from URL ────────────────────────────────

interface SubscriptionDeclaration {
  table: string;
  filter?: unknown;
  fields?: string[];
  operations?: ('insert' | 'update' | 'delete' | 'truncate')[];
  mode: 'stream' | 'snapshot_then_stream';
}

// ── SSE handler ────────────────────────────────────────────────────────────────

/**
 * Framework-agnostic SSE request handler.
 *
 * Usage (Fastify example):
 *   const handler = new SseHandler(deps);
 *   fastify.get('/api/v1/data/:workspace/:schema/realtime', async (req, reply) => {
 *     await handler.handle(adaptFastifyRequest(req), adaptFastifyReply(reply));
 *   });
 */
export class SseHandler {
  constructor(
    private readonly schemas: SchemaService,
    private readonly connections: ConnectionManager,
    private readonly subscriptions: SubscriptionManager,
    private readonly authz: AuthorizationPort,
    private readonly rateLimiter: RateLimiterPort,
    private readonly audit: AuditPort,
    private readonly logger: LoggerPort,
    private readonly metrics: MetricsPort,
  ) {}

  async handle(request: SseRequest, writer: SseWriter): Promise<void> {
    const { ctx } = request;

    if (!ctx.workspaceId) {
      writer.writeHeaders();
      writer.writeEvent(uuidv7(), 'error', JSON.stringify({ code: 'WORKSPACE_CONTEXT_REQUIRED' }));
      writer.end();
      return;
    }

    // Rate limit check at connection time
    const rlResult = await this.rateLimiter.check({
      bucketKey: `realtime:workspace:${ctx.workspaceId}:principal:${ctx.userId}`,
      capacity: REALTIME_DEFAULTS.EVENTS_BURST_CAPACITY,
      refillRate: REALTIME_DEFAULTS.EVENTS_PER_SECOND,
      cost: 1,
    });
    if (rlResult.isOk() && !rlResult.value.allowed) {
      writer.writeHeaders();
      writer.writeEvent(uuidv7(), 'error', JSON.stringify({ code: 'RATE_LIMIT_EXCEEDED' }));
      writer.end();

      void this.audit.write({
        eventType: REALTIME_AUDIT_EVENTS.RATE_LIMIT_EXCEEDED,
        actor: toAuditActor(ctx),
        workspaceId: ctx.workspaceId,
        resource: { type: 'realtime_connection', id: 'sse' },
        action: 'connect',
        outcome: 'denied',
        correlationId: ctx.correlationId,
        ...auditMeta(ctx),
      });
      return;
    }

    // Register connection
    const connResult = await this.connections.register({
      ctx,
      transport: 'sse',
      workspaceId: ctx.workspaceId,
      principalId: ctx.userId,
    });
    if (connResult.isErr()) {
      writer.writeHeaders();
      writer.writeEvent(uuidv7(), 'error', JSON.stringify({ code: connResult.error.code }));
      writer.end();
      return;
    }

    const { connectionId, close } = connResult.value;

    // Resolve schema
    const schemaResult = await this.schemas.resolveDeployedSchema(ctx, request.schemaSlug);
    if (schemaResult.isErr()) {
      close('client_disconnect');
      writer.writeHeaders();
      writer.writeEvent(
        uuidv7(),
        'error',
        JSON.stringify({ code: 'NOT_FOUND', resource: 'schema' }),
      );
      writer.end();
      return;
    }

    const customerSchema = schemaResult.value;

    // Parse subscription declarations from query params
    const declarations = parseSubscriptionDeclarations(request.queryParams);
    if (declarations.length === 0) {
      writer.writeHeaders();
      writer.writeEvent(
        uuidv7(),
        'error',
        JSON.stringify({
          code: 'VALIDATION',
          message: 'No subscriptions declared. Use subscribe[<table>] query params.',
        }),
      );
      close('client_disconnect');
      writer.end();
      return;
    }

    // Resolve table definitions
    const tableDefs = new Map<string, CustomerTableDefinition>();
    for (const decl of declarations) {
      const tableDef = customerSchema.tables.find((t) => t.name === decl.table);
      if (!tableDef) {
        writer.writeHeaders();
        writer.writeEvent(
          uuidv7(),
          'error',
          JSON.stringify({ code: 'NOT_FOUND', resource: 'table', table: decl.table }),
        );
        close('client_disconnect');
        writer.end();
        return;
      }
      tableDefs.set(decl.table, tableDef);
    }

    writer.writeHeaders();

    // Set up disconnect handler (boxed to allow mutation visible across async boundaries)
    const connState = { disconnected: false };
    request.onClose(() => {
      connState.disconnected = true;
      close('client_disconnect');
    });

    // Start subscriptions
    const handles: Array<{ cancel: () => void; events: AsyncIterable<DeliverableEvent> }> = [];

    for (const decl of declarations) {
      const subscriptionId = uuidv7();
      const tableDef = tableDefs.get(decl.table);
      if (!tableDef) continue;

      const subResult = this.subscriptions.subscribe(
        {
          connectionId,
          subscriptionId,
          workspaceId: ctx.workspaceId,
          schemaId: customerSchema.id,
          tableId: decl.table,
          tableDef,
          filter: decl.filter,
          fields: decl.fields,
          operations: decl.operations,
          mode: decl.mode,
        },
        ctx,
      );

      if (subResult.isErr()) {
        writer.writeEvent(
          uuidv7(),
          'error',
          JSON.stringify({ code: subResult.error.code, subscriptionId }),
        );
        continue;
      }

      handles.push(subResult.value);

      void this.audit.write({
        eventType: REALTIME_AUDIT_EVENTS.SUBSCRIPTION_STARTED,
        actor: toAuditActor(ctx),
        workspaceId: ctx.workspaceId,
        resource: { type: 'realtime_subscription', id: subscriptionId },
        action: 'subscribe',
        outcome: 'success',
        correlationId: ctx.correlationId,
        metadata: { connectionId, table: decl.table, mode: decl.mode },
      });
    }

    if (handles.length === 0) {
      close('client_disconnect');
      writer.end();
      return;
    }

    // Heartbeat loop
    const heartbeatInterval = setInterval(() => {
      if (connState.disconnected) {
        clearInterval(heartbeatInterval);
        return;
      }
      this.connections.heartbeat(connectionId);
      writer.writeComment(`heartbeat ${new Date().toISOString()}`);
      this.metrics
        .counter('platform_realtime_heartbeats_total', { description: 'SSE heartbeats sent' })
        .add(1, { workspace: ctx.workspaceId ?? '' });
    }, REALTIME_DEFAULTS.SSE_HEARTBEAT_INTERVAL_MS);

    // Merge all event streams and deliver
    await this.mergeAndDeliver(handles, writer, connectionId, ctx, () => connState.disconnected);

    clearInterval(heartbeatInterval);

    if (!connState.disconnected) {
      writer.end();
    }
  }

  private async mergeAndDeliver(
    handles: Array<{ events: AsyncIterable<DeliverableEvent>; cancel: () => void }>,
    writer: SseWriter,
    connectionId: string,
    ctx: RequestContext,
    isDisconnected: () => boolean,
  ): Promise<void> {
    // Fan-in all subscription streams into one delivery loop
    const ongoing: Array<AsyncIterator<DeliverableEvent>> = handles.map((h) =>
      h.events[Symbol.asyncIterator](),
    );

    const pending = ongoing.map((iter, i) => iter.next().then((res) => ({ res, i })));

    while (pending.length > 0 && !isDisconnected()) {
      const { res, i } = await Promise.race(pending);

      if (res.done) {
        void pending.splice(i, 1);
        void ongoing.splice(i, 1);
        continue;
      }

      const event = res.value;
      const id = uuidv7();
      const data = JSON.stringify(event);
      writer.writeEvent(id, event.kind, data);

      this.connections.heartbeat(connectionId);

      this.metrics
        .counter('platform_realtime_events_delivered_total', {
          description: 'SSE events delivered',
        })
        .add(1, { workspace: ctx.workspaceId ?? '', table: event.table });

      // Refill this slot
      const iter = ongoing[i];
      if (iter !== undefined) {
        pending[i] = iter.next().then((r) => ({ res: r, i }));
      }
    }
  }
}

// ── Parse subscription declarations from URL query params ─────────────────────

/**
 * Parses `subscribe[users][filter][active][_eq]=true&subscribe[users][mode]=snapshot_then_stream`
 * into a list of SubscriptionDeclaration objects.
 */
function parseSubscriptionDeclarations(
  queryParams: Record<string, string | string[]>,
): SubscriptionDeclaration[] {
  const byTable = new Map<string, Record<string, string>>();

  for (const [key, rawValue] of Object.entries(queryParams)) {
    if (!key.startsWith('subscribe[')) continue;
    const value = Array.isArray(rawValue) ? (rawValue[0] ?? '') : rawValue;

    // subscribe[table][...rest] = value
    const inner = key.slice('subscribe['.length);
    const tableEnd = inner.indexOf(']');
    if (tableEnd === -1) continue;

    const table = inner.slice(0, tableEnd);
    const rest = inner.slice(tableEnd + 1);

    let tableMap = byTable.get(table);
    if (!tableMap) {
      tableMap = {};
      byTable.set(table, tableMap);
    }
    tableMap[rest] = value;
  }

  const declarations: SubscriptionDeclaration[] = [];
  for (const [table, params] of byTable) {
    const mode = params['[mode]'] === 'snapshot_then_stream' ? 'snapshot_then_stream' : 'stream';

    const fields =
      params['[fields]']
        ?.split(',')
        .map((f) => f.trim())
        .filter(Boolean) ?? undefined;

    const operations = params['[operations]']
      ?.split(',')
      .map((o) => o.trim() as 'insert' | 'update' | 'delete' | 'truncate')
      .filter(Boolean);

    declarations.push({ table, mode, fields, operations });
  }

  return declarations;
}
