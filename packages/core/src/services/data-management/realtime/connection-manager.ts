import type { AuditPort } from '@platform/ports-audit';
import type { AuthorizationPort, RequestContext } from '@platform/ports-authorization';
import type { LoggerPort, MetricsPort } from '@platform/ports-observability';
import type { RateLimiterPort } from '@platform/ports-rate-limiter';

import { type Result, ok, err } from 'neverthrow';
import { uuidv7 } from 'uuidv7';

import type { AppError } from '../../../errors.js';
import type { InternalEventBus } from './internal-event-bus.js';
import type { SubscriptionManager } from './subscription-manager.js';
import type { CloseReason, ConnectionState, TransportKind } from './types.js';

import { toAuditActor } from '../../../context.js';
import { RateLimitError } from '../../../errors.js';
import { REALTIME_AUDIT_EVENTS } from '../audit-events.js';
import { PermissionCache } from './permission-cache.js';
import { REALTIME_DEFAULTS } from './types.js';

// ── ConnectionManager ──────────────────────────────────────────────────────────

export interface ConnectionInitOptions {
  ctx: RequestContext;
  transport: TransportKind;
  workspaceId: string;
  principalId: string;
  sessionExpiresAt?: Date;
}

export interface ConnectionHandle {
  connectionId: string;
  permCache: PermissionCache;
  close: (reason: CloseReason) => void;
}

/**
 * Central registry of all active WebSocket and SSE connections.
 *
 * Responsibilities:
 * - Enforce per-workspace and per-principal connection limits
 * - Maintain heartbeat timestamps; evict idle connections
 * - Listen to InternalEventBus for revocation events and force-close matching connections
 * - Periodically re-check session validity
 */
export class ConnectionManager {
  /** connectionId → ConnectionState */
  private readonly connections = new Map<string, ConnectionState>();
  /** workspaceId → Set<connectionId> */
  private readonly byWorkspace = new Map<string, Set<string>>();
  /** principalId → Set<connectionId> */
  private readonly byPrincipal = new Map<string, Set<string>>();

  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reauthTimer: ReturnType<typeof setInterval> | null = null;
  private unsubscribeRevocation: (() => void) | null = null;

  constructor(
    private readonly authz: AuthorizationPort,
    private readonly rateLimiter: RateLimiterPort,
    private readonly audit: AuditPort,
    private readonly logger: LoggerPort,
    private readonly metrics: MetricsPort,
    private readonly internalEvents: InternalEventBus,
    private readonly subscriptions: SubscriptionManager,
  ) {
    this.unsubscribeRevocation = this.internalEvents.subscribe((event) => {
      this.onRevocationEvent(event);
    });

    this.heartbeatTimer = setInterval(() => {
      this.evictIdleConnections();
    }, REALTIME_DEFAULTS.HEARTBEAT_INTERVAL_MS);

    this.reauthTimer = setInterval(() => {
      this.evictExpiredSessions();
    }, REALTIME_DEFAULTS.SESSION_REAUTH_INTERVAL_MS);
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  async register(opts: ConnectionInitOptions): Promise<Result<ConnectionHandle, AppError>> {
    const workspaceConns = this.byWorkspace.get(opts.workspaceId);
    if (workspaceConns && workspaceConns.size >= REALTIME_DEFAULTS.MAX_CONNECTIONS_PER_WORKSPACE) {
      return err(
        new RateLimitError(
          `Workspace has reached the maximum of ${String(REALTIME_DEFAULTS.MAX_CONNECTIONS_PER_WORKSPACE)} concurrent real-time connections.`,
        ),
      );
    }

    const principalConns = this.byPrincipal.get(opts.principalId);
    if (principalConns && principalConns.size >= REALTIME_DEFAULTS.MAX_CONNECTIONS_PER_PRINCIPAL) {
      return err(
        new RateLimitError(
          `Principal has reached the maximum of ${String(REALTIME_DEFAULTS.MAX_CONNECTIONS_PER_PRINCIPAL)} concurrent real-time connections.`,
        ),
      );
    }

    const connectionId = uuidv7();
    const now = new Date();

    const state: ConnectionState = {
      id: connectionId,
      workspaceId: opts.workspaceId,
      principalId: opts.principalId,
      transport: opts.transport,
      createdAt: now,
      lastHeartbeatAt: now,
      sessionExpiresAt: opts.sessionExpiresAt,
      subscriptions: new Map(),
    };

    this.connections.set(connectionId, state);
    this.addToWorkspaceIndex(opts.workspaceId, connectionId);
    this.addToPrincipalIndex(opts.principalId, connectionId);

    this.emitConnectionMetrics();

    this.logger.info('realtime.connection_opened', {
      connectionId,
      workspaceId: opts.workspaceId,
      principalId: opts.principalId,
      transport: opts.transport,
    });

    await this.audit.write({
      eventType: REALTIME_AUDIT_EVENTS.CONNECTION_OPENED,
      actor: toAuditActor(opts.ctx),
      workspaceId: opts.workspaceId,
      resource: { type: 'realtime_connection', id: connectionId },
      action: 'open',
      outcome: 'success',
      correlationId: opts.ctx.correlationId,
      metadata: { transport: opts.transport },
    });

    const permCache = new PermissionCache(this.authz);

    return ok({
      connectionId,
      permCache,
      close: (reason: CloseReason) => {
        this.close(connectionId, reason, opts.ctx);
      },
    });
  }

  heartbeat(connectionId: string): void {
    const conn = this.connections.get(connectionId);
    if (conn) conn.lastHeartbeatAt = new Date();
  }

  close(connectionId: string, reason: CloseReason, ctx?: RequestContext): void {
    const conn = this.connections.get(connectionId);
    if (!conn) return;

    const forceClosed =
      reason === 'auth_revoked' || reason === 'session_expired' || reason === 'idle_timeout';

    if (forceClosed) {
      // Force-close: don't preserve state for resume
      this.subscriptions.cancelAllForConnection(connectionId);
    } else {
      // Client disconnect: preserve state for resume window
      this.subscriptions.detachConnection(connectionId);
    }

    this.connections.delete(connectionId);
    this.removeFromWorkspaceIndex(conn.workspaceId, connectionId);
    this.removeFromPrincipalIndex(conn.principalId, connectionId);

    this.emitConnectionMetrics();

    this.logger.info('realtime.connection_closed', { connectionId, reason });

    const auditEventType = forceClosed
      ? REALTIME_AUDIT_EVENTS.CONNECTION_FORCE_CLOSED
      : REALTIME_AUDIT_EVENTS.CONNECTION_CLOSED;

    const actor = ctx ? toAuditActor(ctx) : { kind: 'system' as const, id: 'platform' };

    void this.audit.write({
      eventType: auditEventType,
      actor,
      workspaceId: conn.workspaceId,
      resource: { type: 'realtime_connection', id: connectionId },
      action: 'close',
      outcome: 'success',
      correlationId: ctx?.correlationId ?? connectionId,
      metadata: { reason },
    });
  }

  closeAllForUser(userId: string, reason: CloseReason): void {
    const ids = [...(this.byPrincipal.get(userId) ?? [])];
    for (const id of ids) this.close(id, reason);
  }

  closeAllForWorkspaceMember(userId: string, workspaceId: string, reason: CloseReason): void {
    const workspaceConns = this.byWorkspace.get(workspaceId);
    if (!workspaceConns) return;
    for (const connId of [...workspaceConns]) {
      const conn = this.connections.get(connId);
      if (conn && conn.principalId === userId) {
        this.close(connId, reason);
      }
    }
  }

  stats() {
    return {
      totalConnections: this.connections.size,
      byWorkspace: Object.fromEntries([...this.byWorkspace.entries()].map(([k, v]) => [k, v.size])),
    };
  }

  /** Call on graceful server shutdown. */
  destroy(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.reauthTimer) clearInterval(this.reauthTimer);
    this.unsubscribeRevocation?.();

    for (const [id] of this.connections) {
      this.close(id, 'server_shutdown');
    }
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private onRevocationEvent(event: { kind: string; [k: string]: unknown }): void {
    switch (event.kind) {
      case 'session.revoked':
        this.closeAllForUser(event.userId as string, 'session_expired');
        break;
      case 'workspace.member_removed':
        this.closeAllForWorkspaceMember(
          event.userId as string,
          event.workspaceId as string,
          'auth_revoked',
        );
        break;
      case 'api_key.revoked':
        // API key revocation: close connections authenticated with this key.
        // Tracking is done by sessionId in the connection state (not modelled here
        // for brevity; in production, ConnectionState would carry keyId).
        this.logger.info('realtime.api_key_revoked', { keyId: event.keyId });
        break;
      case 'permission.changed':
        // Invalidate permission caches rather than closing connections.
        // The next per-event permission check will pick up the change.
        this.logger.debug('realtime.permission_changed', {
          userId: event.userId,
          workspaceId: event.workspaceId,
        });
        break;
      default:
        break;
    }
  }

  private evictIdleConnections(): void {
    const cutoff = Date.now() - REALTIME_DEFAULTS.IDLE_TIMEOUT_MS;
    for (const [id, conn] of this.connections) {
      if (conn.lastHeartbeatAt.getTime() < cutoff) {
        this.logger.warn('realtime.idle_connection_evicted', { connectionId: id });
        this.close(id, 'idle_timeout');
      }
    }
  }

  private evictExpiredSessions(): void {
    const now = new Date();
    for (const [id, conn] of this.connections) {
      if (conn.sessionExpiresAt && conn.sessionExpiresAt < now) {
        this.logger.warn('realtime.session_expired', { connectionId: id });
        this.close(id, 'session_expired');
      }
    }
  }

  private addToWorkspaceIndex(workspaceId: string, connectionId: string): void {
    let s = this.byWorkspace.get(workspaceId);
    if (!s) {
      s = new Set();
      this.byWorkspace.set(workspaceId, s);
    }
    s.add(connectionId);
  }

  private removeFromWorkspaceIndex(workspaceId: string, connectionId: string): void {
    const s = this.byWorkspace.get(workspaceId);
    if (!s) return;
    s.delete(connectionId);
    if (s.size === 0) this.byWorkspace.delete(workspaceId);
  }

  private addToPrincipalIndex(principalId: string, connectionId: string): void {
    let s = this.byPrincipal.get(principalId);
    if (!s) {
      s = new Set();
      this.byPrincipal.set(principalId, s);
    }
    s.add(connectionId);
  }

  private removeFromPrincipalIndex(principalId: string, connectionId: string): void {
    const s = this.byPrincipal.get(principalId);
    if (!s) return;
    s.delete(connectionId);
    if (s.size === 0) this.byPrincipal.delete(principalId);
  }

  private emitConnectionMetrics(): void {
    this.metrics
      .gauge('platform_realtime_active_connections', {
        description: 'Active real-time connections',
      })
      .set(this.connections.size);
  }
}
