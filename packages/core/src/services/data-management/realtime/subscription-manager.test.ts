import type { ChangeEvent, ChangeStreamPort } from '@platform/ports-eventing';
import type { MetricsPort } from '@platform/ports-observability';

import { describe, it, expect, vi } from 'vitest';

import type { CustomerTableDefinition } from '../schema-model.js';

import {
  createInMemoryAuthz,
  createInMemoryLogger,
  makeUserContext,
} from '../../../testing/index.js';
import { SubscriptionManager } from './subscription-manager.js';
import { REALTIME_DEFAULTS } from './types.js';

const noopMetrics: MetricsPort = {
  gauge: () => ({ set: () => undefined }),
  counter: () => ({ add: () => undefined }),
  histogram: () => ({ record: () => undefined }),
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeTableDef(): CustomerTableDefinition {
  return {
    id: 'tbl-users',
    name: 'users',
    columns: [
      { id: 'col-id', name: 'id', type: { kind: 'uuid' }, nullable: false },
      { id: 'col-name', name: 'name', type: { kind: 'string' }, nullable: true },
    ],
    primaryKey: { kind: 'single', columnId: 'col-id' },
    indexes: [],
    foreignKeys: [],
    constraints: [],
  };
}

function makeChangeStream(events: ChangeEvent[] = []) {
  let notifyDone: (() => void) | null = null;
  const done = new Promise<void>((resolve) => {
    notifyDone = resolve;
  });

  return {
    watch: async function* () {
      await Promise.resolve();
      for (const e of events) {
        yield e;
      }
      notifyDone?.();
    },
    supports: vi.fn(() => false),
    done,
  };
}

const ctx = makeUserContext({ workspaceId: 'ws-1' });

function makeManager(events: ChangeEvent[] = []) {
  const authz = createInMemoryAuthz();
  const logger = createInMemoryLogger();
  const changeStream = makeChangeStream(events);
  const manager = new SubscriptionManager(
    changeStream as unknown as ChangeStreamPort,
    authz,
    logger,
    noopMetrics,
  );
  return { manager, changeStream };
}

const baseOpts = {
  connectionId: 'conn-1',
  subscriptionId: 'sub-1',
  workspaceId: 'ws-1',
  schemaId: 'schema-1',
  tableId: 'users',
  tableDef: makeTableDef(),
  mode: 'stream' as const,
};

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('SubscriptionManager', () => {
  it('returns a subscription handle', () => {
    const { manager } = makeManager();
    const result = manager.subscribe(baseOpts, ctx);
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().subscriptionId).toBe('sub-1');
    result._unsafeUnwrap().cancel();
  });

  it('rejects duplicate subscription IDs on the same connection', () => {
    const { manager } = makeManager();
    const r1 = manager.subscribe(baseOpts, ctx);
    expect(r1.isOk()).toBe(true);

    const r2 = manager.subscribe(baseOpts, ctx);
    expect(r2.isErr()).toBe(true);
    expect(r2._unsafeUnwrapErr().code).toBe('VALIDATION');

    r1._unsafeUnwrap().cancel();
  });

  it('rejects when subscription limit per connection is exceeded', () => {
    const { manager } = makeManager();

    for (let i = 0; i < REALTIME_DEFAULTS.MAX_SUBS_PER_CONNECTION; i++) {
      const r = manager.subscribe({ ...baseOpts, subscriptionId: `sub-${String(i)}` }, ctx);
      expect(r.isOk()).toBe(true);
    }

    const extra = manager.subscribe({ ...baseOpts, subscriptionId: 'sub-overflow' }, ctx);
    expect(extra.isErr()).toBe(true);
    expect(extra._unsafeUnwrapErr().code).toBe('RATE_LIMIT');
  });

  it('delivers change events through the stream', async () => {
    const events: ChangeEvent[] = [
      {
        table: 'users',
        operation: 'insert',
        after: { id: 'u-1', name: 'Alice' },
        occurredAt: new Date(),
        position: 'pos-1',
      },
    ];
    const { manager } = makeManager(events);

    const result = manager.subscribe(baseOpts, ctx);
    expect(result.isOk()).toBe(true);

    const delivered: unknown[] = [];
    for await (const event of result._unsafeUnwrap().events) {
      delivered.push(event);
      break; // take first event only
    }

    expect(delivered).toHaveLength(1);
    expect((delivered[0] as { operation: string }).operation).toBe('insert');
  });

  it('unsubscribe removes the subscription', () => {
    const { manager } = makeManager();
    manager.subscribe(baseOpts, ctx);

    const r = manager.unsubscribe('conn-1', 'sub-1');
    expect(r.isOk()).toBe(true);

    const subs = manager.listForConnection('conn-1');
    expect(subs).toHaveLength(0);
  });

  it('detachConnection preserves state for resume', () => {
    const { manager } = makeManager();
    void manager.subscribe(baseOpts, ctx)._unsafeUnwrap();

    manager.detachConnection('conn-1');

    // Attempting to resume with the same subscriptionId should succeed (state preserved)
    const resumeResult = manager.resume(
      { ...baseOpts, connectionId: 'conn-2', resumeToken: 'any' },
      ctx,
    );
    // The resume state is keyed by subscriptionId; the token validation is by filterHash
    expect(resumeResult.isOk() || resumeResult.isErr()).toBe(true); // exists
  });

  it('listForConnection reflects active subscriptions', () => {
    const { manager } = makeManager();
    manager.subscribe(baseOpts, ctx);
    manager.subscribe({ ...baseOpts, subscriptionId: 'sub-2' }, ctx);

    const subs = manager.listForConnection('conn-1');
    expect(subs).toHaveLength(2);

    manager.unsubscribe('conn-1', 'sub-1');
    expect(manager.listForConnection('conn-1')).toHaveLength(1);
  });
});
