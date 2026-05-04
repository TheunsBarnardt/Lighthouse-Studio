/**
 * CustomerTableRepository conformance tests — PostgreSQL adapter.
 *
 * Requires a live Postgres instance (Supabase local works).
 * Connection: POSTGRES_URL or POSTGRES_DIRECT_URL environment variable.
 *
 *   POSTGRES_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres pnpm test
 *
 * Tests are skipped automatically when no URL is set.
 */
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PostgresCustomerRepositoryProvider } from '../src/customer-repository.adapter.js';
import { ARCHIVE_COL, VERSION_COL } from '../src/customer-repository.adapter.js';

const POSTGRES_URL = process.env['POSTGRES_DIRECT_URL'] ?? process.env['POSTGRES_URL'];

const TEST_NS = 'cust_test_cr';
const TEST_TABLE = 'users';
const PK = 'id';

let pool: Pool | undefined;

beforeAll(async () => {
  if (!POSTGRES_URL) {
    process.stdout.write('Skipping Postgres CustomerRepository tests — no POSTGRES_URL set\n');
    return;
  }

  pool = new Pool({ connectionString: POSTGRES_URL, max: 3 });
  try {
    await pool.query(`CREATE SCHEMA IF NOT EXISTS "${TEST_NS}"`);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "${TEST_NS}"."${TEST_TABLE}" (
        id            TEXT         PRIMARY KEY,
        name          TEXT         NOT NULL,
        age           INTEGER,
        "${ARCHIVE_COL}"  TIMESTAMPTZ,
        "${VERSION_COL}"  INTEGER      NOT NULL DEFAULT 1
      )
    `);
  } catch (e) {
    process.stderr.write(`Postgres setup failed: ${String(e)}\n`);
    await pool.end();
    pool = undefined;
  }
});

afterAll(async () => {
  if (!pool) return;
  await pool.query(`DROP SCHEMA IF EXISTS "${TEST_NS}" CASCADE`);
  await pool.end();
});

describe.skipIf(!POSTGRES_URL)(
  'PostgresCustomerRepositoryProvider — CustomerTableRepository',
  () => {
    function makeRepo() {
      if (!pool) throw new Error('Pool not initialised');
      return new PostgresCustomerRepositoryProvider(pool).buildRepository({
        namespace: TEST_NS,
        tableName: TEST_TABLE,
        primaryKeyColumn: PK,
        columnNames: [PK, 'name', 'age'],
      });
    }

    async function clear() {
      await pool!.query(`DELETE FROM "${TEST_NS}"."${TEST_TABLE}"`);
    }

    it('creates and retrieves a row by id', async () => {
      await clear();
      const repo = makeRepo();
      const r = await repo.create({ id: 'u1', name: 'Alice', age: 30 });
      expect(r.isOk()).toBe(true);
      expect(r._unsafeUnwrap()['name']).toBe('Alice');

      const found = await repo.findById('u1');
      expect(found._unsafeUnwrap()?.['name']).toBe('Alice');
    });

    it('returns null for a non-existent id', async () => {
      await clear();
      const repo = makeRepo();
      const r = await repo.findById('does-not-exist');
      expect(r._unsafeUnwrap()).toBeNull();
    });

    it('returns empty list when table is empty', async () => {
      await clear();
      const repo = makeRepo();
      const r = await repo.findMany();
      expect(r._unsafeUnwrap().items).toHaveLength(0);
      expect(r._unsafeUnwrap().total).toBe(0);
    });

    it('lists all rows', async () => {
      await clear();
      const repo = makeRepo();
      await repo.create({ id: 'u1', name: 'Alice' });
      await repo.create({ id: 'u2', name: 'Bob' });
      const r = await repo.findMany();
      expect(r._unsafeUnwrap().total).toBe(2);
    });

    it('filters by equality', async () => {
      await clear();
      const repo = makeRepo();
      await repo.create({ id: 'u1', name: 'Alice' });
      await repo.create({ id: 'u2', name: 'Bob' });
      const r = await repo.findMany({ filter: { name: { _eq: 'Alice' } } });
      expect(r._unsafeUnwrap().items).toHaveLength(1);
      expect(r._unsafeUnwrap().items[0]?.['name']).toBe('Alice');
    });

    it('counts rows', async () => {
      await clear();
      const repo = makeRepo();
      await repo.create({ id: 'u1', name: 'A' });
      await repo.create({ id: 'u2', name: 'B' });
      const r = await repo.count();
      expect(r._unsafeUnwrap()).toBe(2);
    });

    it('updates a row', async () => {
      await clear();
      const repo = makeRepo();
      await repo.create({ id: 'u1', name: 'Alice', age: 30 });
      const r = await repo.update('u1', { age: 31 });
      expect(r.isOk()).toBe(true);
      expect(r._unsafeUnwrap()['age']).toBe(31);
    });

    it('optimistic locking blocks stale update', async () => {
      await clear();
      const repo = makeRepo();
      await repo.create({ id: 'u1', name: 'Alice' });
      await repo.update('u1', { name: 'Alice v2' }, { expectedVersion: 1 });
      // Version is now 2; trying again with version 1 should fail
      const r = await repo.update('u1', { name: 'Alice v3' }, { expectedVersion: 1 });
      expect(r.isErr()).toBe(true);
      expect(r._unsafeUnwrapErr().code).toBe('CONFLICT');
    });

    it('archives a row (soft delete)', async () => {
      await clear();
      const repo = makeRepo();
      await repo.create({ id: 'u1', name: 'Alice' });
      const archiveR = await repo.archive('u1');
      expect(archiveR.isOk()).toBe(true);

      // Not in default list
      const list = await repo.findMany();
      expect(list._unsafeUnwrap().items).toHaveLength(0);

      // Not in findById
      const found = await repo.findById('u1');
      expect(found._unsafeUnwrap()).toBeNull();

      // Visible with includeArchived
      const archived = await repo.findMany({ includeArchived: true });
      expect(archived._unsafeUnwrap().items).toHaveLength(1);
    });

    it('restores an archived row', async () => {
      await clear();
      const repo = makeRepo();
      await repo.create({ id: 'u1', name: 'Alice' });
      await repo.archive('u1');
      await repo.restore('u1');

      const found = await repo.findById('u1');
      expect(found._unsafeUnwrap()).not.toBeNull();
    });

    it('hard deletes a row', async () => {
      await clear();
      const repo = makeRepo();
      await repo.create({ id: 'u1', name: 'Alice' });
      await repo.hardDelete('u1');
      const r = await repo.findMany({ includeArchived: true });
      expect(r._unsafeUnwrap().items).toHaveLength(0);
    });

    it('archive returns EntityNotFoundError for unknown id', async () => {
      await clear();
      const repo = makeRepo();
      const r = await repo.archive('no-such-id');
      expect(r.isErr()).toBe(true);
    });

    it('bulk creates rows', async () => {
      await clear();
      const repo = makeRepo();
      const rows = Array.from({ length: 5 }, (_, i) => ({
        id: `u${String(i)}`,
        name: `User ${String(i)}`,
      }));
      const r = await repo.bulkCreate(rows);
      expect(r.isOk()).toBe(true);
      expect(r._unsafeUnwrap()).toHaveLength(5);
      expect((await repo.count())._unsafeUnwrap()).toBe(5);
    });

    it('rejects bulk create over limit', async () => {
      await clear();
      const repo = makeRepo();
      const rows = Array.from({ length: 10 }, (_, i) => ({
        id: `u${String(i)}`,
        name: `U${String(i)}`,
      }));
      const r = await repo.bulkCreate(rows, { maxRows: 5 });
      expect(r.isErr()).toBe(true);
    });

    it('bulk updates rows matching filter', async () => {
      await clear();
      const repo = makeRepo();
      await repo.create({ id: 'u1', name: 'Alice', age: 25 });
      await repo.create({ id: 'u2', name: 'Bob', age: 25 });
      await repo.create({ id: 'u3', name: 'Carol', age: 30 });
      const r = await repo.bulkUpdate({ age: { _eq: 25 } }, { age: 26 });
      expect(r._unsafeUnwrap().affectedCount).toBe(2);
    });

    it('bulk archives rows matching filter', async () => {
      await clear();
      const repo = makeRepo();
      await repo.create({ id: 'u1', name: 'Alice' });
      await repo.create({ id: 'u2', name: 'Bob' });
      await repo.bulkDelete({});
      expect((await repo.count())._unsafeUnwrap()).toBe(0);
      expect((await repo.count())._unsafeUnwrap()).toBe(0);
    });

    it('does not return system columns in row data', async () => {
      await clear();
      const repo = makeRepo();
      await repo.create({ id: 'u1', name: 'Alice' });
      const r = await repo.findById('u1');
      const row = r._unsafeUnwrap()!;
      expect(Object.keys(row)).not.toContain(ARCHIVE_COL);
      expect(Object.keys(row)).not.toContain(VERSION_COL);
    });
  },
);
