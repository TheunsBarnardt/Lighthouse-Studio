import type { AuthorizationPort, RequestContext } from '@platform/ports-authorization';
import type { ChangeStreamPort } from '@platform/ports-eventing';
import type { LoggerPort, MetricsPort } from '@platform/ports-observability';
import type { Result } from 'neverthrow';

import { ok, err } from 'neverthrow';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

import type { AppError } from '../../../errors.js';
import type {
  ActiveSubscription,
  DeliverableEvent,
  ResumeTokenPayload,
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
 *  - Delivers to caller via AsyncGenerator with per-event token-bucket rate limiting
 *  - Enforces bounded buffer (REALTIME_DEFAULTS.BUFFER_SIZE)
 *  - Enforces snapshot row-count limit (REALTIME_DEFAULTS.SNAPSHOT_MAX_ROWS)
 *  - Supports snapshot_then_stream mode
 *  - Supports resume-after-disconnect (within RESUME_WINDOW_MS)
 *  - Issues HMAC-signed, base64url-encoded resume tokens
 */
export class SubscriptionManager {
  /** connectionId → subscriptionId → ActiveSubscription */
  private readonly subscriptions = new Map<string, Map<string, ActiveSubscription>>();
  /** Detached state kept for RESUME_WINDOW_MS after disconnect. */
  private readonly resumeState = new Map<
    string,
    ActiveSubscription & { resumeExpiry: Date; encodedToken: string }
  >();
  private readonly pipeline = new EventFilterPipelineImpl();

  constructor(
    private readonly changeStreams: ChangeStreamPort,
    private readonly authz: AuthorizationPort,
    private readonly logger: LoggerPort,
    private readonly metrics: MetricsPort,
    /** Secret used to HMAC-sign resume tokens. Must be at least 32 bytes. */
    private readonly resumeTokenSecret: string = 'default-dev-secret-replace-in-prod',
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

    // Snapshot size guard — reject before opening the stream
    if (
      opts.mode === 'snapshot_then_stream' &&
      opts.rowCount !== undefined &&
      opts.rowCount > REALTIME_DEFAULTS.SNAPSHOT_MAX_ROWS
    ) {
      return err(
        new RateLimitError(
          `Table has ${String(opts.rowCount)} rows which exceeds the snapshot limit of ${String(REALTIME_DEFAULTS.SNAPSHOT_MAX_ROWS)}. ` +
            'Use stream mode instead, or apply a filter to reduce the result set.',
        ),
      );
    }

    if (
      opts.mode === 'snapshot_then_stream' &&
      !this.changeStreams.supports('replay_from_position')
    ) {
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
      ...(opts.filter !== undefined && { filter: opts.filter }),
      ...(opts.fields !== undefined && { fields: opts.fields }),
      ...(opts.operations !== undefined && { operations: opts.operations }),
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
   * Validates the HMAC-signed resume token, the filter hash, and the resume window.
   */
  resume(
    opts: SubscribeOptions & { resumeToken: string },
    ctx: RequestContext,
  ): Result<SubscriptionHandle, AppError> {
    // Decode and verify the token before looking up state
    const payload = this.decodeResumeToken(opts.resumeToken);
    if (!payload) {
      return err(new ValidationError('Resume token is invalid or has been tampered with.'));
    }

    if (payload.subscriptionId !== opts.subscriptionId) {
      return err(new ValidationError('Resume token subscription ID mismatch.'));
    }

    if (new Date(payload.expiresAt) < new Date()) {
      return err(new ValidationError('Resume token has expired. Re-subscribe with snapshot mode.'));
    }

    const expectedFilterHash = hashFilter(opts.filter);
    if (payload.filterHash !== expectedFilterHash) {
      return err(new ValidationError('Resume token filter mismatch. Re-subscribe.'));
    }

    const saved = this.resumeState.get(opts.subscriptionId);
    if (!saved) {
      return err(
        new ValidationError('Resume state not found (may have been cleaned up). Re-subscribe.'),
      );
    }

    if (new Date() > saved.resumeExpiry) {
      this.resumeState.delete(opts.subscriptionId);
      return err(new ValidationError('Resume window expired. Re-subscribe with snapshot mode.'));
    }

    this.resumeState.delete(opts.subscriptionId);

    // Restore state into the new connection
    const ac = new AbortController();
    const permCache = new PermissionCache(this.authz);

    const { resumeExpiry: _resumeExpiry, encodedToken: _encodedToken, ...savedBase } = saved;
    const sub: ActiveSubscription = {
      ...savedBase,
      connectionId: opts.connectionId,
      cancel: () => {
        ac.abort();
      },
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

      const payload: ResumeTokenPayload = {
        connectionId,
        subscriptionId: sub.id,
        lastDeliveredPosition: sub.lastDeliveredPosition ?? '',
        filterHash: hashFilter(sub.filter),
        expiresAt: expiry.toISOString(),
      };

      const encodedToken = this.encodeResumeToken(payload);
      this.resumeState.set(sub.id, { ...sub, resumeExpiry: expiry, encodedToken });
    }

    connSubs.clear();
    this.subscriptions.delete(connectionId);
  }

  /**
   * Retrieve the encoded resume token for a subscription (for delivery to the client).
   * Returns null if the subscription is not detached (still active or expired).
   */
  getResumeToken(subscriptionId: string): string | null {
    return this.resumeState.get(subscriptionId)?.encodedToken ?? null;
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

  /**
   * Push a schema_change event to all active subscriptions watching the given schemaId.
   * Called by ConnectionManager when a schema.deployed internal event is received.
   */
  notifySchemaChange(schemaId: string): void {
    for (const connSubs of this.subscriptions.values()) {
      for (const sub of connSubs.values()) {
        if (sub.schemaId !== schemaId) continue;

        const event: DeliverableEvent = {
          subscriptionId: sub.id,
          kind: 'schema_change',
          table: sub.tableId,
          position: sub.lastDeliveredPosition ?? '',
          occurredAt: new Date().toISOString(),
          metadata: { schemaId },
        };

        this.bufferEvent(sub, event);
      }
    }
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private async *buildEventStream(
    sub: ActiveSubscription,
    ctx: RequestContext,
    permCache: PermissionCache,
    signal: AbortSignal,
    resumeFromPosition?: string,
  ): AsyncGenerator<DeliverableEvent> {
    // Per-subscription token bucket: EVENTS_PER_SECOND sustained, EVENTS_BURST_CAPACITY burst.
    // Shared across a subscription's lifetime; prevents a single fast table from
    // flooding the connection beyond the declared limits.
    let tokens: number = REALTIME_DEFAULTS.EVENTS_BURST_CAPACITY;
    let lastRefillMs = Date.now();

    const consumeToken = (): boolean => {
      const now = Date.now();
      const elapsedSec = (now - lastRefillMs) / 1000;
      tokens = Math.min(
        REALTIME_DEFAULTS.EVENTS_BURST_CAPACITY,
        tokens + elapsedSec * REALTIME_DEFAULTS.EVENTS_PER_SECOND,
      );
      lastRefillMs = now;
      if (tokens >= 1) {
        tokens -= 1;
        return true;
      }
      return false;
    };

    const watchOpts: Parameters<ChangeStreamPort['watch']>[0] = {
      table: sub.tableId,
      schema: sub.schemaId,
      ...(sub.operations !== undefined && { operations: sub.operations }),
    };

    if (resumeFromPosition && this.changeStreams.supports('replay_from_position')) {
      (watchOpts as unknown as Record<string, unknown>)['resumeToken'] = resumeFromPosition;
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

        // Per-event rate limiting: drop and record a gap when the bucket is empty
        if (!consumeToken()) {
          sub.totalDropped++;
          this.metrics
            .counter('platform_realtime_events_dropped_total', { description: 'Dropped events' })
            .add(1, { workspace: sub.workspaceId, table: sub.tableId, reason: 'rate_limited' });

          const gap: DeliverableEvent = {
            subscriptionId: sub.id,
            kind: 'gap',
            table: sub.tableId,
            position: event.position,
            occurredAt: new Date().toISOString(),
            metadata: { totalDropped: sub.totalDropped, reason: 'rate_limited' },
          };
          this.bufferEvent(sub, gap);
          continue;
        }

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

  // ── Resume token encoding ───────────────────────────────────────────────────

  /**
   * Encodes a ResumeTokenPayload as: base64url(JSON + "." + HMAC-SHA256-hex)
   * The HMAC prevents clients from forging or mutating the token.
   */
  private encodeResumeToken(payload: ResumeTokenPayload): string {
    const json = JSON.stringify(payload);
    const sig = createHmac('sha256', this.resumeTokenSecret).update(json).digest('hex');
    return Buffer.from(`${json}.${sig}`).toString('base64url');
  }

  /**
   * Decodes and verifies an encoded resume token.
   * Returns null if the token is malformed or the signature doesn't match.
   */
  private decodeResumeToken(token: string): ResumeTokenPayload | null {
    try {
      const decoded = Buffer.from(token, 'base64url').toString('utf8');
      const lastDot = decoded.lastIndexOf('.');
      if (lastDot === -1) return null;

      const json = decoded.slice(0, lastDot);
      const receivedSig = decoded.slice(lastDot + 1);
      const expectedSig = createHmac('sha256', this.resumeTokenSecret).update(json).digest('hex');

      // Timing-safe comparison to prevent timing attacks
      const receivedBuf = Buffer.from(receivedSig, 'hex');
      const expectedBuf = Buffer.from(expectedSig, 'hex');
      if (receivedBuf.length !== expectedBuf.length || !timingSafeEqual(receivedBuf, expectedBuf)) {
        return null;
      }

      return JSON.parse(json) as ResumeTokenPayload;
    } catch {
      return null;
    }
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function hashFilter(filter: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(filter ?? null))
    .digest('hex');
}
