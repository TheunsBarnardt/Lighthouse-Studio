import type { AuthorizationPort, RequestContext } from '@platform/ports-authorization';
import type { ChangeStreamPort } from '@platform/ports-eventing';
import type { LoggerPort, MetricsPort } from '@platform/ports-observability';
import type { Result } from 'neverthrow';

import { ok, err } from 'neverthrow';
import { createHash } from 'node:crypto';

import type { AppError } from '../../../errors.js';
import type {
  ActiveSubscription,
  DeliverableEvent,
  SubscribeOptions,
  SubscriptionHandle,
} from './types.js';

import { ValidationError, RateLimitError } from '../../../errors.js';
import { EventFilterPipelineImpl } from './event-filter-pipeline.js';
import { PermissionCache } from './permission-cache.js';
import { REALTIME_DEFAULTS } from './types.js';

// ── SubscriptionManager ────────────────────────────────────────────────────────

/**
 * Owns the lifecycle of every active subscription across all connections.
 *
 * Per subscription:
 *  - Opens an AsyncIterable from ChangeStreamPort.watch()
 *  - Runs each event through EventFilterPipeline
 *  - Delivers to caller via AsyncGenerator
 *  - Enforces bounded buffer (REALTIME_DEFAULTS.BUFFER_SIZE)
 *  - Supports snapshot_then_stream mode
 *  - Supports resume-after-disconnect (within RESUME_WINDOW_MS)
 */
export class SubscriptionManager {
  /** connectionId → subscriptionId → ActiveSubscription */
  private readonly subscriptions = new Map<string, Map<string, ActiveSubscription>>();
  /** Detached state kept for RESUME_WINDOW_MS after disconnect. */
  private readonly resumeState = new Map<string, ActiveSubscription & { resumeExpiry: Date }>();
  private readonly pipeline = new EventFilterPipelineImpl();

  constructor(
    private readonly changeStreams: ChangeStreamPort,
    private readonly authz: AuthorizationPort,
    private readonly logger: LoggerPort,
    private readonly metrics: MetricsPort,
  ) {}

  // ── Public API ──────────────────────────────────────────────────────────────

  subscribe(opts: SubscribeOptions, ctx: RequestContext): Result<SubscriptionHandle, AppError> {
    const connSubs = this.getOrCreateConnectionMap(opts.connectionId);

    if (connSubs.size >= REALTIME_DEFAULTS.MAX_SUBS_PER_CONNECTION) {
      return err(
        new RateLimitError(
          `Connection already has ${String(REALTIME_DEFAULTS.MAX_SUBS_PER_CONNECTION)} subscriptions (the maximum). Unsubscribe first.`,
        ),
      );
    }

    if (connSubs.has(opts.subscriptionId)) {
      return err(
        new ValidationError(
          `Subscription ID '${opts.subscriptionId}' already in use on this connection.`,
        ),
      );
    }

    if (
      opts.mode === 'snapshot_then_stream' &&
      !this.changeStreams.supports('replay_from_position')
    ) {
      // Snapshot mode requires replay capability; fall back gracefully
      this.logger.warn('realtime.snapshot_not_supported', {
        workspaceId: opts.workspaceId,
        tableId: opts.tableId,
      });
    }

    const ac = new AbortController();
    const permCache = new PermissionCache(this.authz);

    const sub: ActiveSubscription = {
      id: opts.subscriptionId,
      connectionId: opts.connectionId,
      workspaceId: opts.workspaceId,
      schemaId: opts.schemaId,
      tableId: opts.tableId,
      tableDef: opts.tableDef,
      filter: opts.filter,
      fields: opts.fields,
      operations: opts.operations,
      mode: opts.mode,
      buffer: [],
      totalDropped: 0,
      createdAt: new Date(),
      cancel: () => {
        ac.abort();
      },
    };

    connSubs.set(opts.subscriptionId, sub);

    this.metrics
      .gauge('platform_realtime_active_subscriptions', { description: 'Active subscriptions' })
      .set(this.totalSubscriptionCount(), { workspace: opts.workspaceId });

    const events = this.buildEventStream(sub, ctx, permCache, ac.signal);

    this.logger.debug('realtime.subscription_started', {
      connectionId: opts.connectionId,
      subscriptionId: opts.subscriptionId,
      tableId: opts.tableId,
      mode: opts.mode,
    });

    return ok({
      subscriptionId: opts.subscriptionId,
      events,
      cancel: () => {
        this.doCancel(opts.connectionId, opts.subscriptionId);
      },
    });
  }

  unsubscribe(connectionId: string, subscriptionId: string): Result<void, AppError> {
    this.doCancel(connectionId, subscriptionId);
    return ok(undefined);
  }

  /**
   * Resume a subscription that was active before the client disconnected.
   * Looks up saved state keyed by subscriptionId; validates the filterHash.
   */
  resume(
    opts: SubscribeOptions & { resumeToken: string },
    ctx: RequestContext,
  ): Result<SubscriptionHandle, AppError> {
    const saved = this.resumeState.get(opts.subscriptionId);
    if (!saved) {
      return err(
        new ValidationError('Resume token expired or unknown. Re-subscribe with snapshot mode.'),
      );
    }

    const expectedHash = hashFilter(opts.filter);
    const savedHash = hashFilter(saved.filter);
    if (expectedHash !== savedHash) {
      return err(new ValidationError('Resume token filter mismatch. Re-subscribe.'));
    }

    if (new Date() > saved.resumeExpiry) {
      this.resumeState.delete(opts.subscriptionId);
      return err(new ValidationError('Resume window expired. Re-subscribe with snapshot mode.'));
    }

    this.resumeState.delete(opts.subscriptionId);

    // Restore state into the new connection
    const ac = new AbortController();
    const permCache = new PermissionCache(this.authz);

    const sub: ActiveSubscription = {
      ...saved,
      connectionId: opts.connectionId,
      cancel: () => {
        ac.abort();
      },
      resumeExpiry: undefined,
    };

    const connSubs = this.getOrCreateConnectionMap(opts.connectionId);
    connSubs.set(opts.subscriptionId, sub);

    this.logger.debug('realtime.subscription_resumed', {
      connectionId: opts.connectionId,
      subscriptionId: opts.subscriptionId,
      fromPosition: saved.lastDeliveredPosition,
    });

    const events = this.buildEventStream(
      sub,
      ctx,
      permCache,
      ac.signal,
      saved.lastDeliveredPosition,
    );

    return ok({
      subscriptionId: opts.subscriptionId,
      events,
      cancel: () => {
        this.doCancel(opts.connectionId, opts.subscriptionId);
      },
    });
  }

  /** Called when a connection closes so subscriptions can be saved for resume. */
  detachConnection(connectionId: string): void {
    const connSubs = this.subscriptions.get(connectionId);
    if (!connSubs) return;

    const expiry = new Date(Date.now() + REALTIME_DEFAULTS.RESUME_WINDOW_MS);
    for (const [, sub] of connSubs) {
      sub.cancel();
      this.resumeState.set(sub.id, { ...sub, resumeExpiry: expiry });
    }

    connSubs.clear();
    this.subscriptions.delete(connectionId);
  }

  /** Immediately cancel all subscriptions on a connection (revocation path). */
  cancelAllForConnection(connectionId: string): void {
    const connSubs = this.subscriptions.get(connectionId);
    if (!connSubs) return;
    for (const [, sub] of connSubs) {
      sub.cancel();
    }
    connSubs.clear();
    this.subscriptions.delete(connectionId);
  }

  listForConnection(connectionId: string): ActiveSubscription[] {
    return [...(this.subscriptions.get(connectionId)?.values() ?? [])];
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private async *buildEventStream(
    sub: ActiveSubscription,
    ctx: RequestContext,
    permCache: PermissionCache,
    signal: AbortSignal,
    resumeFromPosition?: string,
  ): AsyncGenerator<DeliverableEvent> {
    const watchOpts: Parameters<ChangeStreamPort['watch']>[0] = {
      table: sub.tableId,
      schema: sub.schemaId,
      operations: sub.operations,
    };

    if (resumeFromPosition && this.changeStreams.supports('replay_from_position')) {
      (watchOpts as Record<string, unknown>)['resumeToken'] = resumeFromPosition;
    }

    // Emit any buffered events first (backlog from disconnect)
    while (sub.buffer.length > 0) {
      const buffered = sub.buffer.shift();
      if (buffered === undefined) break;
      sub.lastDeliveredPosition = buffered.position;
      yield buffered;
    }

    if (
      sub.mode === 'snapshot_then_stream' &&
      this.changeStreams.supports('replay_from_position')
    ) {
      yield {
        subscriptionId: sub.id,
        kind: 'snapshot_complete',
        table: sub.tableId,
        position: 'snapshot',
        occurredAt: new Date().toISOString(),
      };
    }

    try {
      for await (const event of this.changeStreams.watch(watchOpts)) {
        if (signal.aborted) break;

        const deliverable = await this.pipeline.process(event, sub, ctx, permCache);
        if (!deliverable) continue;

        sub.lastDeliveredPosition = event.position;

        this.bufferEvent(sub, deliverable);
        while (sub.buffer.length > 0) {
          const next = sub.buffer.shift();
          if (next === undefined) break;
          yield next;
        }
      }
    } catch (error) {
      this.logger.error('realtime.change_stream_error', {
        subscriptionId: sub.id,
        tableId: sub.tableId,
        error,
      });
      yield {
        subscriptionId: sub.id,
        kind: 'error',
        table: sub.tableId,
        position: sub.lastDeliveredPosition ?? '',
        occurredAt: new Date().toISOString(),
        metadata: { message: 'Change stream encountered an error. Please re-subscribe.' },
      };
    }
  }

  private bufferEvent(sub: ActiveSubscription, event: DeliverableEvent): void {
    if (sub.buffer.length >= REALTIME_DEFAULTS.BUFFER_SIZE) {
      // Drop the oldest event and emit a gap
      sub.buffer.shift();
      sub.totalDropped++;
      this.metrics
        .counter('platform_realtime_events_dropped_total', { description: 'Dropped events' })
        .add(1, { workspace: sub.workspaceId, table: sub.tableId, reason: 'buffer_overflow' });

      const gap: DeliverableEvent = {
        subscriptionId: sub.id,
        kind: 'gap',
        table: sub.tableId,
        position: event.position,
        occurredAt: new Date().toISOString(),
        metadata: { totalDropped: sub.totalDropped },
      };
      sub.buffer.push(gap);
    }
    sub.buffer.push(event);
  }

  private doCancel(connectionId: string, subscriptionId: string): void {
    const connSubs = this.subscriptions.get(connectionId);
    const sub = connSubs?.get(subscriptionId);
    if (!sub) return;
    sub.cancel();
    connSubs?.delete(subscriptionId);
    if (connSubs?.size === 0) this.subscriptions.delete(connectionId);

    this.logger.debug('realtime.subscription_cancelled', { connectionId, subscriptionId });
  }

  private getOrCreateConnectionMap(connectionId: string): Map<string, ActiveSubscription> {
    let m = this.subscriptions.get(connectionId);
    if (!m) {
      m = new Map();
      this.subscriptions.set(connectionId, m);
    }
    return m;
  }

  private totalSubscriptionCount(): number {
    let total = 0;
    for (const m of this.subscriptions.values()) total += m.size;
    return total;
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function hashFilter(filter: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(filter ?? null))
    .digest('hex');
}
