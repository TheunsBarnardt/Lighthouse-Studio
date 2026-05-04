/**
 * PostgreSQL repository conformance tests.
 *
 * These tests require a live Postgres instance.
 * Set POSTGRES_DIRECT_URL or POSTGRES_URL in the environment before running.
 *
 * Run with: pnpm test (will be skipped automatically if no database is available)
 */

import { runRepositoryConformance } from '@platform/ports-persistence/conformance';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, it, expect } from 'vitest';

import { createFieldMapper } from '../src/mapper.js';
import { createPostgresRepository } from '../src/repository.adapter.js';

interface TestEntity {
  id: string;
  name: string;
  value: number;
}

const POSTGRES_URL = process.env['POSTGRES_DIRECT_URL'] ?? process.env['POSTGRES_URL'];
const TEST_TABLE = 'test_conformance';

let pool: Pool | undefined;

beforeAll(async () => {
  if (!POSTGRES_URL) {
    process.stdout.write('Skipping Postgres conformance tests — no POSTGRES_URL set\n');
    return;
  }

  pool = new Pool({ connectionString: POSTGRES_URL, max: 3 });

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "${TEST_TABLE}" (
        id          UUID    PRIMARY KEY,
        name        TEXT    NOT NULL,
        value       INTEGER NOT NULL DEFAULT 0,
        "_version"  INTEGER NOT NULL DEFAULT 1,
        "_archived_at" TIMESTAMPTZ,
        "_created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "_updated_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  } catch (e) {
    process.stderr.write(`Failed to create test table: ${String(e)}\n`);
    await pool.end();
    pool = undefined;
  }
});

afterAll(async () => {
  if (!pool) return;
  await pool.query(`DROP TABLE IF EXISTS "${TEST_TABLE}"`);
  await pool.end();
});

describe.skipIf(!POSTGRES_URL)('PostgreSQL repository conformance', () => {
  const mapper = createFieldMapper<TestEntity>({
    id: 'id',
    name: 'name',
    value: 'value',
  });

  runRepositoryConformance(
    'PostgresRepository',
    async () => {
      if (!pool) throw new Error('Pool not initialised');

      // Clear the table before each test run
      await pool.query(`TRUNCATE "${TEST_TABLE}"`);

      return createPostgresRepository<TestEntity>(
        pool,
        {
          schema: 'public',
          table: TEST_TABLE,
          columns: [
            'id',
            'name',
            'value',
            '_version',
            '_archived_at',
            '_created_at',
            '_updated_at',
          ],
        },
        mapper,
      );
    },
    {
      makeEntity: (overrides?) => ({
        id: crypto.randomUUID(),
        name: 'test entity',
        value: 42,
        ...overrides,
      }),
      makeId: () => crypto.randomUUID(),
    },
  );

  it('optimistic locking blocks a concurrent update', async () => {
    if (!pool) return;
    const mapper2 = createFieldMapper<TestEntity>({ id: 'id', name: 'name', value: 'value' });
    const repo = createPostgresRepository<TestEntity>(
      pool,
      {
        schema: 'public',
        table: TEST_TABLE,
        columns: ['id', 'name', 'value', '_version', '_archived_at', '_created_at', '_updated_at'],
      },
      mapper2,
    );

    const entity: TestEntity = { id: crypto.randomUUID(), name: 'lock-test', value: 0 };
    await repo.create(entity);

    // First update with version 1 — should succeed
    const first = await repo.update(entity.id, { value: 1 } as Partial<Omit<TestEntity, 'id'>>, {
      expectedVersion: 1,
    });
    expect(first.isOk()).toBe(true);

    // Second update with stale version 1 — should fail with ConflictError
    const second = await repo.update(entity.id, { value: 2 } as Partial<Omit<TestEntity, 'id'>>, {
      expectedVersion: 1,
    });
    expect(second.isErr()).toBe(true);
    expect(second._unsafeUnwrapErr().code).toBe('CONFLICT');
  });

  it('soft delete hides the row from findById', async () => {
    if (!pool) return;
    const repo = createPostgresRepository<TestEntity>(
      pool,
      {
        schema: 'public',
        table: TEST_TABLE,
        columns: ['id', 'name', 'value', '_version', '_archived_at', '_created_at', '_updated_at'],
      },
      mapper,
    );

    const entity: TestEntity = { id: crypto.randomUUID(), name: 'archive-test', value: 0 };
    await repo.create(entity);

    const before = await repo.findById(entity.id);
    expect(before._unsafeUnwrap()).not.toBeNull();

    await repo.archive(entity.id);

    const after = await repo.findById(entity.id);
    expect(after._unsafeUnwrap()).toBeNull();
  });

  it('hardDelete logs at warn level (smoke test)', async () => {
    if (!pool) return;
    const logs: string[] = [];
    const fakeLogger = {
      trace: () => {},
      debug: () => {},
      info: () => {},
      warn: (msg: string) => {
        logs.push(msg);
      },
      error: () => {},
      fatal: () => {},
      child: () => fakeLogger,
    };

    const repo = createPostgresRepository<TestEntity>(
      pool,
      {
        schema: 'public',
        table: TEST_TABLE,
        columns: ['id', 'name', 'value', '_version', '_archived_at', '_created_at', '_updated_at'],
      },
      mapper,
      { logger: fakeLogger },
    );

    const entity: TestEntity = { id: crypto.randomUUID(), name: 'hard-delete-test', value: 0 };
    await repo.create(entity);
    await repo.hardDelete(entity.id);

    expect(logs.some((m) => m.toLowerCase().includes('hard delete'))).toBe(true);
  });
});
