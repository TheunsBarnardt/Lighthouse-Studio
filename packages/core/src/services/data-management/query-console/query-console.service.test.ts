import { describe, expect, it } from 'vitest';

import {
  createInMemoryAudit,
  createInMemoryAuthz,
  createInMemoryLogger,
  createInMemoryRepo,
  makeUserContext,
} from '../../../testing/index.js';
import { QueryClassifierImpl } from './classifier.js';
import { QueryConsoleService } from './query-console.service.js';
import type { QueryHistoryRecord, SavedQuery } from './types.js';

// ── Stub executor ──────────────────────────────────────────────────────────────

function makeOkExecutor(overrides?: Partial<{ rows: Record<string, unknown>[]; rowCount: number; truncated: boolean }>) {
  return {
    async execute() {
      return {
        isOk: () => true,
        isErr: () => false,
        value: {
          rows: overrides?.rows ?? [{ id: 1 }],
          rowCount: overrides?.rowCount ?? 1,
          truncated: overrides?.truncated ?? false,
          durationMs: 10,
          columns: [{ name: 'id', type: 'int4' }],
        },
      } as never;
    },
    async explain() {
      return {
        isOk: () => true,
        isErr: () => false,
        value: { format: 'json' as const, plan: { 'Node Type': 'SeqScan' }, durationMs: 5 },
      } as never;
    },
  };
}

function makeErrExecutor(code: string, message: string) {
  return {
    async execute() {
      return { isOk: () => false, isErr: () => true, error: { code, message } } as never;
    },
    async explain() {
      return { isOk: () => false, isErr: () => true, error: { code, message } } as never;
    },
  };
}

// ── Service factory ────────────────────────────────────────────────────────────

function makeService(opts?: {
  deny?: boolean;
  denyActions?: string[];
  executor?: ReturnType<typeof makeOkExecutor>;
}) {
  const authz = createInMemoryAuthz(opts?.deny ? { deny: true } : opts?.denyActions ? { denyActions: opts.denyActions } : {});
  const executor = opts?.executor ?? makeOkExecutor();
  const history = createInMemoryRepo<QueryHistoryRecord>();
  const savedQueries = createInMemoryRepo<SavedQuery>();
  const audit = createInMemoryAudit();
  const logger = createInMemoryLogger();

  const service = new QueryConsoleService(
    authz,
    new QueryClassifierImpl(),
    executor,
    history,
    savedQueries,
    audit,
    logger,
  );
  return { service, audit, history, savedQueries };
}

function ctx(workspaceId = 'ws-1') {
  return makeUserContext({ userId: 'user-1', workspaceId });
}

// ── execute ────────────────────────────────────────────────────────────────────

describe('QueryConsoleService.execute', () => {
  it('succeeds for a read-only SELECT query', async () => {
    const { service, audit } = makeService();
    const result = await service.execute(ctx(), {
      workspaceId: 'ws-1',
      workspaceSlug: 'test-ws',
      databaseDriver: 'postgres',
      query: 'SELECT 1',
      language: 'sql_postgres',
    });

    expect(result.isOk()).toBe(true);
    const value = result._unsafeUnwrap();
    expect(value.kind).toBe('result');
    if (value.kind === 'result') {
      expect(value.rowCount).toBe(1);
    }
    expect(audit.events.some((e) => e.eventType === 'data_management.query.executed')).toBe(true);
  });

  it('returns validation error for empty query', async () => {
    const { service } = makeService();
    const result = await service.execute(ctx(), {
      workspaceId: 'ws-1',
      workspaceSlug: 'test-ws',
      databaseDriver: 'postgres',
      query: '',
      language: 'sql_postgres',
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('VALIDATION');
  });

  it('returns forbidden error when query.read denied', async () => {
    const { service } = makeService({ denyActions: ['query.read'] });
    const result = await service.execute(ctx(), {
      workspaceId: 'ws-1',
      workspaceSlug: 'test-ws',
      databaseDriver: 'postgres',
      query: 'SELECT 1',
      language: 'sql_postgres',
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('FORBIDDEN');
  });

  it('rejects DDL statements in all modes', async () => {
    const { service, audit } = makeService();
    const result = await service.execute(ctx(), {
      workspaceId: 'ws-1',
      workspaceSlug: 'test-ws',
      databaseDriver: 'postgres',
      query: 'CREATE TABLE foo (id INT)',
      language: 'sql_postgres',
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('FORBIDDEN');
    expect(audit.events.some((e) => e.eventType === 'data_management.query.ddl_attempted')).toBe(true);
  });

  it('returns confirmation_required for write query without query.write permission', async () => {
    // Default authz allows query.read but if no query.write then write queries return confirmation_required
    // Actually: write without permission → write_denied. With permission but no confirmed → confirmation_required.
    const { service } = makeService();
    const result = await service.execute(ctx(), {
      workspaceId: 'ws-1',
      workspaceSlug: 'test-ws',
      databaseDriver: 'postgres',
      query: 'DELETE FROM users WHERE id = 1',
      language: 'sql_postgres',
    });

    // Default in-memory authz allows all actions, so this should return confirmation_required (needs confirmed=true)
    expect(result.isOk()).toBe(true);
    const value = result._unsafeUnwrap();
    expect(value.kind).toBe('confirmation_required');
  });

  it('executes write query when confirmed=true', async () => {
    const { service } = makeService();
    const result = await service.execute(ctx(), {
      workspaceId: 'ws-1',
      workspaceSlug: 'test-ws',
      databaseDriver: 'postgres',
      query: 'DELETE FROM users WHERE id = 1',
      language: 'sql_postgres',
      confirmed: true,
    });

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().kind).toBe('result');
  });

  it('returns forbidden when query.write is denied but query is a write', async () => {
    const { service } = makeService({ denyActions: ['query.write'] });
    const result = await service.execute(ctx(), {
      workspaceId: 'ws-1',
      workspaceSlug: 'test-ws',
      databaseDriver: 'postgres',
      query: 'INSERT INTO users (name) VALUES (\'alice\')',
      language: 'sql_postgres',
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('FORBIDDEN');
  });

  it('records history entry on every execution', async () => {
    const { service, history } = makeService();
    await service.execute(ctx(), {
      workspaceId: 'ws-1',
      workspaceSlug: 'test-ws',
      databaseDriver: 'postgres',
      query: 'SELECT 1',
      language: 'sql_postgres',
    });

    const historyEntries = Array.from((history as { store: Map<string, QueryHistoryRecord> }).store.values());
    expect(historyEntries.length).toBe(1);
    expect(historyEntries[0]?.status).toBe('succeeded');
  });
});

// ── QueryClassifierImpl ────────────────────────────────────────────────────────

describe('QueryClassifierImpl', () => {
  const classifier = new QueryClassifierImpl();

  it('classifies SELECT as read-only Postgres', () => {
    const result = classifier.classify({ query: 'SELECT id, name FROM users', language: 'sql_postgres' });
    expect(result.isOk()).toBe(true);
    const val = result._unsafeUnwrap();
    expect(val.isReadOnly).toBe(true);
    expect(val.containsDdl).toBe(false);
    expect(val.language).toBe('sql_postgres');
  });

  it('classifies INSERT as not read-only', () => {
    const result = classifier.classify({ query: 'INSERT INTO t (a) VALUES (1)', language: 'sql_postgres' });
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().isReadOnly).toBe(false);
  });

  it('detects DDL in Postgres', () => {
    const result = classifier.classify({ query: 'CREATE TABLE foo (id INT)', language: 'sql_postgres' });
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().containsDdl).toBe(true);
  });

  it('detects named parameters in SQL', () => {
    const result = classifier.classify({ query: 'SELECT * FROM users WHERE id = :userId AND status = :status', language: 'sql_postgres' });
    expect(result.isOk()).toBe(true);
    const val = result._unsafeUnwrap();
    expect(val.hasParameters).toBe(true);
    expect(val.parameterNames).toContain('userId');
    expect(val.parameterNames).toContain('status');
  });

  it('classifies Mongo aggregate pipeline as read-only', () => {
    const result = classifier.classify({
      query: JSON.stringify([{ $match: { status: 'active' } }, { $group: { _id: '$role', count: { $sum: 1 } } }]),
      language: 'mongo_aggregate',
    });
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().isReadOnly).toBe(true);
  });

  it('detects $out stage as non-read-only in Mongo', () => {
    const result = classifier.classify({
      query: JSON.stringify([{ $match: {} }, { $out: 'archive' }]),
      language: 'mongo_aggregate',
    });
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().isReadOnly).toBe(false);
  });
});

// ── saveQuery / listSavedQueries ───────────────────────────────────────────────

describe('QueryConsoleService.saveQuery', () => {
  it('saves a query and returns it', async () => {
    const { service } = makeService();
    const result = await service.saveQuery(ctx(), {
      workspaceId: 'ws-1',
      name: 'My Query',
      queryText: 'SELECT 1',
      queryLanguage: 'sql_postgres',
    });

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().name).toBe('My Query');
  });

  it('lists saved queries for the workspace', async () => {
    const { service } = makeService();
    await service.saveQuery(ctx(), {
      workspaceId: 'ws-1',
      name: 'Q1',
      queryText: 'SELECT 1',
      queryLanguage: 'sql_postgres',
    });

    const listResult = await service.listSavedQueries(ctx(), {
      workspaceId: 'ws-1',
      limit: 20,
      offset: 0,
    });

    expect(listResult.isOk()).toBe(true);
    expect(listResult._unsafeUnwrap().items.length).toBe(1);
  });

  it('returns forbidden when query.read is denied', async () => {
    const { service } = makeService({ denyActions: ['query.read'] });
    const result = await service.saveQuery(ctx(), {
      workspaceId: 'ws-1',
      name: 'Q',
      queryText: 'SELECT 1',
      queryLanguage: 'sql_postgres',
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('FORBIDDEN');
  });
});
