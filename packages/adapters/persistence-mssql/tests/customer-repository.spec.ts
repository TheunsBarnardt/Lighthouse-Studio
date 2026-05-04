/**
 * CustomerTableRepository conformance tests — MSSQL adapter.
 *
 * Requires a live SQL Server instance.
 *
 * Windows Auth (NTLM):
 *   MSSQL_SERVER=localhost MSSQL_DOMAIN=AFRICA MSSQL_USER=103298 MSSQL_PASSWORD="" MSSQL_TRUST_CERT=true pnpm test
 *
 * SQL Auth:
 *   MSSQL_CONNECTION_STRING="Server=localhost;Database=master;User Id=sa;Password=..." pnpm test
 *
 * Tests are skipped automatically when no connection config is set or connection fails.
 */
import * as mssql from 'mssql';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  MssqlCustomerRepositoryProvider,
  ARCHIVE_COL,
  VERSION_COL,
} from '../src/customer-repository.adapter.js';

const CONN_STR = process.env['MSSQL_CONNECTION_STRING'];

const MSSQL_SERVER = process.env['MSSQL_SERVER'];

function buildConfig(): mssql.config | null {
  if (!CONN_STR && !MSSQL_SERVER) return null;

  if (CONN_STR) {
    return { connectionString: CONN_STR } as unknown as mssql.config;
  }

  const domain = process.env['MSSQL_DOMAIN'];

  const user = process.env['MSSQL_USER'];

  const password = process.env['MSSQL_PASSWORD'] ?? '';

  const trustCert = process.env['MSSQL_TRUST_CERT'] === 'true';

  const cfg: mssql.config = {
    server: MSSQL_SERVER!,
    database: 'master',
    options: {
      trustServerCertificate: trustCert,
      enableArithAbort: true,
    },
    pool: { max: 3, min: 0, idleTimeoutMillis: 30000 },
    connectionTimeout: 10000,
    requestTimeout: 10000,
  };

  if (domain && user) {
    // NTLM Windows Authentication
    cfg.authentication = {
      type: 'ntlm',
      options: {
        domain,
        userName: user,
        password,
      },
    };
  } else if (user) {
    cfg.user = user;
    cfg.password = password;
  }

  return cfg;
}

const TEST_NS = 'cust_test_cr_ms';
const TEST_TABLE = 'users';
const PK = 'id';

let pool: mssql.ConnectionPool | undefined;

beforeAll(async () => {
  const cfg = buildConfig();
  if (!cfg) {
    process.stdout.write('Skipping MSSQL CustomerRepository tests — no connection config set\n');
    return;
  }

  try {
    pool = await new mssql.ConnectionPool(cfg).connect();
    const req = pool.request();
    await req.query(
      `IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = '${TEST_NS}') EXEC('CREATE SCHEMA [${TEST_NS}]')`,
    );
    const req2 = pool.request();
    await req2.query(`
      IF NOT EXISTS (
        SELECT 1 FROM sys.tables t
        JOIN sys.schemas s ON t.schema_id = s.schema_id
        WHERE s.name = '${TEST_NS}' AND t.name = '${TEST_TABLE}'
      )
      CREATE TABLE [${TEST_NS}].[${TEST_TABLE}] (
        id            NVARCHAR(255)   NOT NULL PRIMARY KEY,
        name          NVARCHAR(255)   NOT NULL,
        age           INT,
        [${ARCHIVE_COL}]  DATETIMEOFFSET,
        [${VERSION_COL}]  INT             NOT NULL DEFAULT 1
      )
    `);
  } catch (e) {
    process.stderr.write(`MSSQL setup failed: ${String(e)}\n`);
    await pool?.close();
    pool = undefined;
  }
});

afterAll(async () => {
  if (!pool) return;
  try {
    const req = pool.request();
    await req.query(`DROP TABLE IF EXISTS [${TEST_NS}].[${TEST_TABLE}]`);
    const req2 = pool.request();
    await req2.query(`DROP SCHEMA IF EXISTS [${TEST_NS}]`);
  } finally {
    await pool.close();
  }
});

describe.skipIf(!CONN_STR && !MSSQL_SERVER)(
  'MssqlCustomerRepositoryProvider — CustomerTableRepository',
  () => {
    // Skip individual tests when setup failed (e.g. TCP/IP not enabled on the server)
    beforeEach((ctx) => {
      if (!pool) ctx.skip();
    });

    function makeRepo() {
      if (!pool) throw new Error('Pool not initialised');
      return new MssqlCustomerRepositoryProvider(pool).buildRepository({
        namespace: TEST_NS,
        tableName: TEST_TABLE,
        primaryKeyColumn: PK,
        columnNames: [PK, 'name', 'age'],
      });
    }

    async function clear() {
      if (!pool) return;
      const req = pool.request();
      await req.query(`DELETE FROM [${TEST_NS}].[${TEST_TABLE}]`);
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
