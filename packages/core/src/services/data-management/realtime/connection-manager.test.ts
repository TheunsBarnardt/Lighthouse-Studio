import type { ChangeStreamPort } from '@platform/ports-eventing';
import type { MetricsPort } from '@platform/ports-observability';

import { describe, it, expect, vi } from 'vitest';

import {
  createInMemoryAudit,
  createInMemoryAuthz,
  createInMemoryLogger,
  makeUserContext,
} from '../../../testing/index.js';
import { ConnectionManager } from './connection-manager.js';
import { InProcessEventBus } from './internal-event-bus.js';
import { SubscriptionManager } from './subscription-manager.js';

// ── In-memory metrics stub ─────────────────────────────────────────────────────

const noopMetrics: MetricsPort = {
  gauge: () => ({ set: () => undefined }),
  counter: () => ({ add: () => undefined }),
  histogram: () => ({ record: () => undefined }),
};

// ── In-memory change stream stub ───────────────────────────────────────────────

function makeChangeStream() {
  return {
    watch: vi.fn(async function* () {
      await Promise.resolve();
    }),
    supports: vi.fn(() => false),
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeManager() {
  const authz = createInMemoryAuthz();
  const audit = createInMemoryAudit();
  const logger = createInMemoryLogger();
  const eventBus = new InProcessEventBus();
  const changeStream = makeChangeStream();
  const subManager = new SubscriptionManager(
    changeStream as unknown as ChangeStreamPort,
    authz,
    logger,
    noopMetrics,
  );
  const manager = new ConnectionManager(authz, audit, logger, noopMetrics, eventBus, subManager);
  return { manager, eventBus, audit, logger };
}

const ctx = makeUserContext({ workspaceId: 'ws-1' });

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('ConnectionManager', () => {
  it('registers a connection and returns a connectionId', async () => {
    const { manager } = makeManager();
    const result = await manager.register({
      ctx,
      transport: 'sse',
      workspaceId: 'ws-1',
      principalId: 'user-1',
    });

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().connectionId).toBeDefined();
    manager.destroy();
  });

  it('rejects registration when workspace limit is exceeded', async () => {
    const { manager } = makeManager();
    // Register 1000 connections for the same workspace
    const promises = Array.from({ length: 1000 }, () =>
      manager.register({
        ctx,
        transport: 'sse',
        workspaceId: 'ws-1',
        principalId: `user-${Math.random()}`,
      }),
    );
    await Promise.all(promises);

    // 1001st should fail
    const extra = await manager.register({
      ctx,
      transport: 'sse',
      workspaceId: 'ws-1',
      principalId: 'user-extra',
    });

    expect(extra.isErr()).toBe(true);
    expect(extra._unsafeUnwrapErr().code).toBe('RATE_LIMIT');
    manager.destroy();
  });

  it('rejects registration when per-principal limit is exceeded', async () => {
    const { manager } = makeManager();
    // Register 10 connections for the same principal
    const promises = Array.from({ length: 10 }, () =>
      manager.register({
        ctx,
        transport: 'sse',
        workspaceId: `ws-${Math.random()}`,
        principalId: 'user-1',
      }),
    );
    await Promise.all(promises);

    const extra = await manager.register({
      ctx,
      transport: 'sse',
      workspaceId: 'ws-extra',
      principalId: 'user-1',
    });

    expect(extra.isErr()).toBe(true);
    expect(extra._unsafeUnwrapErr().code).toBe('RATE_LIMIT');
    manager.destroy();
  });

  it('closes connections for a user on session.revoked event', async () => {
    const { manager, eventBus } = makeManager();

    const reg = await manager.register({
      ctx,
      transport: 'websocket',
      workspaceId: 'ws-1',
      principalId: 'user-revoked',
    });
    expect(reg.isOk()).toBe(true);

    // Stats before revocation
    expect(manager.stats().totalConnections).toBe(1);

    // Publish revocation event
    eventBus.publish({ kind: 'session.revoked', sessionId: 's1', userId: 'user-revoked' });

    // Connection should be gone immediately (synchronous delivery)
    expect(manager.stats().totalConnections).toBe(0);
    manager.destroy();
  });

  it('closes connections for a workspace member on member_removed event', async () => {
    const { manager, eventBus } = makeManager();

    await manager.register({
      ctx,
      transport: 'websocket',
      workspaceId: 'ws-target',
      principalId: 'user-member',
    });
    expect(manager.stats().totalConnections).toBe(1);

    eventBus.publish({
      kind: 'workspace.member_removed',
      userId: 'user-member',
      workspaceId: 'ws-target',
    });

    expect(manager.stats().totalConnections).toBe(0);
    manager.destroy();
  });

  it('does not close connections for the wrong workspace on member_removed', async () => {
    const { manager, eventBus } = makeManager();

    await manager.register({
      ctx,
      transport: 'websocket',
      workspaceId: 'ws-other',
      principalId: 'user-member',
    });
    expect(manager.stats().totalConnections).toBe(1);

    // Remove from a DIFFERENT workspace
    eventBus.publish({
      kind: 'workspace.member_removed',
      userId: 'user-member',
      workspaceId: 'ws-target',
    });

    // Should not close
    expect(manager.stats().totalConnections).toBe(1);
    manager.destroy();
  });

  it('updates heartbeat timestamp', async () => {
    const { manager } = makeManager();
    const result = await manager.register({
      ctx,
      transport: 'sse',
      workspaceId: 'ws-1',
      principalId: 'user-1',
    });
    const { connectionId } = result._unsafeUnwrap();

    // This should not throw
    manager.heartbeat(connectionId);
    manager.destroy();
  });

  it('writes audit entry for forced close', async () => {
    const { manager, audit } = makeManager();
    const result = await manager.register({
      ctx,
      transport: 'sse',
      workspaceId: 'ws-1',
      principalId: 'user-1',
    });
    const { connectionId } = result._unsafeUnwrap();

    // Opening already wrote an audit entry
    const openEvents = audit.events.filter(
      (e) => e.eventType === 'data_management.realtime.connection_opened',
    );
    expect(openEvents).toHaveLength(1);

    manager.close(connectionId, 'auth_revoked');

    const closeEvents = audit.events.filter(
      (e) => e.eventType === 'data_management.realtime.connection_force_closed',
    );
    expect(closeEvents).toHaveLength(1);
    manager.destroy();
  });
});
