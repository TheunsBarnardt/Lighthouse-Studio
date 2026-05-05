/**
 * Conformance tests for PostgresRawQueryAdapter against a real Postgres instance.
 *
 * Skipped unless QUERY_CONSOLE_DATABASE_URL is set:
 *
 *   QUERY_CONSOLE_DATABASE_URL=postgres://localhost:5432/test_db \
 *     pnpm --filter @platform/adapter-persistence-postgres test
 *
 * The database must have:
 *   - A test schema: CREATE SCHEMA cust_test;
 *   - A test table:  CREATE TABLE cust_test.items (id SERIAL PRIMARY KEY, name TEXT, deleted_at TIMESTAMPTZ);
 *   - A readonly role:         CREATE ROLE cust_testws_readonly;
 *   - A console_writer role:   CREATE ROLE cust_testws_console_writer;
 *   - Appropriate GRANTs on both roles for cust_test schema
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const DB_URL = process.env['QUERY_CONSOLE_DATABASE_URL'];
const haveDatabase = !!DB_URL;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Pool = any;

async function makePool(url: string): Promise<Pool> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pg: any = await import('pg');

  return new pg.Pool({ connectionString: url });
}

describe.skipIf(!haveDatabase)('PostgresRawQueryAdapter conformance', () => {
  let readonlyPool: Pool;
  let writerPool: Pool;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let adapter: any;

  beforeAll(async () => {
    readonlyPool = await makePool(DB_URL!);
    writerPool = await makePool(DB_URL!);
    const { PostgresRawQueryAdapter } = await import('./raw-query.adapter.js');
    adapter = new PostgresRawQueryAdapter({ readonly: readonlyPool, console_writer: writerPool });

    // Seed test data
    await readonlyPool.query(`
      CREATE TABLE IF NOT EXISTS cust_test.items (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        deleted_at TIMESTAMPTZ
      )
    `);
    await readonlyPool.query(`TRUNCATE cust_test.items`);
    await readonlyPool.query(
      `INSERT INTO cust_test.items (name) VALUES ('alpha'), ('beta'), ('gamma')`,
    );
  });

  afterAll(async () => {
    await readonlyPool.query(`DROP TABLE IF EXISTS cust_test.items`);
    await readonlyPool.end();
    await writerPool.end();
  });

  const baseOpts = {
    workspaceId: 'ws-test',
    customerSchema: 'cust_test',
    parameters: {},
    language: 'sql_postgres' as const,
    role: 'readonly' as const,
    timeoutMs: 10_000,
    rowLimit: 100,
  };

  // ── Read-only SELECT ──────────────────────────────────────────────────────────

  it('executes a SELECT and returns rows', async () => {
    const result = await adapter.execute({
      ...baseOpts,
      query: 'SELECT id, name FROM cust_test.items ORDER BY id',
    });

    expect(result.isOk()).toBe(true);
    const value = result._unsafeUnwrap();
    expect(value.rows).toHaveLength(3);
    expect(value.columns.map((c: { name: string }) => c.name)).toContain('name');
    expect(value.truncated).toBe(false);
    expect(value.durationMs).toBeGreaterThanOrEqual(0);
  });

  // ── Row limit ────────────────────────────────────────────────────────────────

  it('respects rowLimit and sets truncated=true', async () => {
    const result = await adapter.execute({
      ...baseOpts,
      query: 'SELECT id, name FROM cust_test.items ORDER BY id',
      rowLimit: 2,
    });

    expect(result.isOk()).toBe(true);
    const value = result._unsafeUnwrap();
    expect(value.rows).toHaveLength(2);
    expect(value.truncated).toBe(true);
  });

  // ── Named parameters ─────────────────────────────────────────────────────────

  it('binds named parameters correctly', async () => {
    const result = await adapter.execute({
      ...baseOpts,
      query: 'SELECT name FROM cust_test.items WHERE name = :targetName',
      parameters: { targetName: 'beta' },
    });

    expect(result.isOk()).toBe(true);
    const value = result._unsafeUnwrap();
    expect(value.rows).toHaveLength(1);
    expect((value.rows[0] as { name: string }).name).toBe('beta');
  });

  // ── Statement timeout ────────────────────────────────────────────────────────

  it('times out a long-running query', async () => {
    const result = await adapter.execute({
      ...baseOpts,
      query: 'SELECT pg_sleep(10)',
      timeoutMs: 200,
    });

    expect(result.isErr()).toBe(true);
    // pg_sleep timeout surfaces as a statement_timeout error (code 57014)
    expect(result._unsafeUnwrapErr().code).toMatch(/TIMEOUT|PERSISTENCE/);
  });

  // ── Abort signal cancellation ────────────────────────────────────────────────

  it('cancels an in-flight query via AbortController', async () => {
    const controller = new AbortController();

    const execPromise = adapter.execute({
      ...baseOpts,
      query: 'SELECT pg_sleep(30)',
      timeoutMs: 60_000,
      abortSignal: controller.signal,
    });

    // Abort after a short delay
    setTimeout(() => {
      controller.abort();
    }, 100);

    const result = await execPromise;
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toMatch(/CANCELLED|PERSISTENCE/);
  });

  // ── EXPLAIN ──────────────────────────────────────────────────────────────────

  it('returns a JSON query plan for EXPLAIN', async () => {
    const result = await adapter.explain({
      ...baseOpts,
      query: 'SELECT id FROM cust_test.items WHERE name = :n',
      parameters: { n: 'alpha' },
    });

    expect(result.isOk()).toBe(true);
    const value = result._unsafeUnwrap();
    expect(value.format).toBe('json');
    expect(value.plan).toBeTruthy();
    expect(typeof value.durationMs).toBe('number');
  });

  // ── Write query (console_writer role) ────────────────────────────────────────

  it('executes an INSERT via the console_writer role', async () => {
    const result = await adapter.execute({
      ...baseOpts,
      role: 'console_writer',
      query: "INSERT INTO cust_test.items (name) VALUES ('delta') RETURNING id, name",
    });

    expect(result.isOk()).toBe(true);
    const value = result._unsafeUnwrap();
    expect(value.rows).toHaveLength(1);
    expect((value.rows[0] as { name: string }).name).toBe('delta');
  });

  // ── Column metadata ──────────────────────────────────────────────────────────

  it('returns column metadata with types', async () => {
    const result = await adapter.execute({
      ...baseOpts,
      query: 'SELECT id, name, deleted_at FROM cust_test.items LIMIT 1',
    });

    expect(result.isOk()).toBe(true);
    const cols = result._unsafeUnwrap().columns as { name: string; dataType: string }[];
    expect(cols.find((c) => c.name === 'id')).toBeDefined();
    expect(cols.find((c) => c.name === 'name')).toBeDefined();
    expect(cols.find((c) => c.name === 'deleted_at')).toBeDefined();
  });
});
