/**
 * CustomerTableRepository performance tests — PostgreSQL adapter.
 *
 * Seeds 100 000 rows and measures p95 latency for common access patterns.
 *
 * Only runs when PERF_TEST=true AND a Postgres connection URL is set:
 *
 *   PERF_TEST=true POSTGRES_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres pnpm test customer-repository.perf
 *
 * Targets (p95):
 *   findById        < 20 ms
 *   findMany page   < 100 ms
 *   count           < 100 ms
 */
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PostgresCustomerRepositoryProvider } from '../src/customer-repository.adapter.js';

const PERF_TEST = process.env['PERF_TEST'] === 'true';

const POSTGRES_URL = process.env['POSTGRES_DIRECT_URL'] ?? process.env['POSTGRES_URL'];

const TEST_NS = 'cust_perf_cr';
const TEST_TABLE = 'items';
const PK = 'id';
const SEED_ROWS = 100_000;
const BATCH_SIZE = 1_000;
const ITERATIONS = 100;

function p95(samples: number[]): number {
  const sorted = [...samples].sort((a, b) => a - b);
  const idx = Math.ceil(sorted.length * 0.95) - 1;
  return sorted[Math.max(0, idx)] ?? 0;
}

async function time<T>(fn: () => Promise<T>): Promise<{ result: T; ms: number }> {
  const t0 = performance.now();
  const result = await fn();
  return { result, ms: performance.now() - t0 };
}

let pool: Pool | undefined;

beforeAll(async () => {
  if (!PERF_TEST || !POSTGRES_URL) return;

  pool = new Pool({ connectionString: POSTGRES_URL, max: 5 });

  await pool.query(`CREATE SCHEMA IF NOT EXISTS "${TEST_NS}"`);
  await pool.query(`DROP TABLE IF EXISTS "${TEST_NS}"."${TEST_TABLE}"`);
  await pool.query(`
    CREATE TABLE "${TEST_NS}"."${TEST_TABLE}" (
      id           TEXT        NOT NULL PRIMARY KEY,
      name         TEXT        NOT NULL,
      category     TEXT        NOT NULL,
      score        INT,
      _pf_archived_at TIMESTAMPTZ,
      _pf_version  INT         NOT NULL DEFAULT 1
    )
  `);

  const provider = new PostgresCustomerRepositoryProvider(pool);
  const repo = provider.buildRepository({
    namespace: TEST_NS,
    tableName: TEST_TABLE,
    primaryKeyColumn: PK,
    columnNames: [PK, 'name', 'category', 'score'],
  });

  process.stdout.write(`Seeding ${SEED_ROWS} rows in batches of ${BATCH_SIZE}…\n`);
  const categories = ['alpha', 'beta', 'gamma', 'delta', 'epsilon'];
  for (let b = 0; b < SEED_ROWS / BATCH_SIZE; b++) {
    const rows = Array.from({ length: BATCH_SIZE }, (_, i) => {
      const n = b * BATCH_SIZE + i;
      return {
        id: `item_${String(n).padStart(7, '0')}`,
        name: `Item ${String(n)}`,
        category: categories[n % categories.length] ?? 'alpha',
        score: n % 100,
      };
    });
    const r = await repo.bulkCreate(rows);
    if (r.isErr()) throw new Error(`Seed failed at batch ${String(b)}: ${r.error.message}`);
  }
  process.stdout.write('Seed complete.\n');
});

afterAll(async () => {
  if (!pool) return;
  await pool.query(`DROP TABLE IF EXISTS "${TEST_NS}"."${TEST_TABLE}"`);
  await pool.query(`DROP SCHEMA IF EXISTS "${TEST_NS}"`);
  await pool.end();
});

describe.skipIf(!PERF_TEST || !POSTGRES_URL)(
  'CustomerTableRepository performance — 100k rows',
  () => {
    function makeRepo() {
      if (!pool) throw new Error('Pool not initialised');
      return new PostgresCustomerRepositoryProvider(pool).buildRepository({
        namespace: TEST_NS,
        tableName: TEST_TABLE,
        primaryKeyColumn: PK,
        columnNames: [PK, 'name', 'category', 'score'],
      });
    }

    it(`findById p95 < 20 ms (${ITERATIONS} iterations)`, async () => {
      const repo = makeRepo();
      const samples: number[] = [];
      for (let i = 0; i < ITERATIONS; i++) {
        const id = `item_${String(i * 1000).padStart(7, '0')}`;
        const { ms } = await time(() => repo.findById(id));
        samples.push(ms);
      }
      const result = p95(samples);
      process.stdout.write(`  findById p95: ${result.toFixed(2)} ms\n`);
      expect(result).toBeLessThan(20);
    });

    it(`findMany (page 50) p95 < 100 ms (${ITERATIONS} iterations)`, async () => {
      const repo = makeRepo();
      const samples: number[] = [];
      for (let i = 0; i < ITERATIONS; i++) {
        const offset = (i * 500) % (SEED_ROWS - 50);
        const { ms } = await time(() => repo.findMany({ page: { limit: 50, offset } }));
        samples.push(ms);
      }
      const result = p95(samples);
      process.stdout.write(`  findMany p95: ${result.toFixed(2)} ms\n`);
      expect(result).toBeLessThan(100);
    });

    it(`count p95 < 100 ms (${ITERATIONS} iterations)`, async () => {
      const repo = makeRepo();
      const samples: number[] = [];
      for (let i = 0; i < ITERATIONS; i++) {
        const { ms } = await time(() => repo.count());
        samples.push(ms);
      }
      const result = p95(samples);
      process.stdout.write(`  count p95: ${result.toFixed(2)} ms\n`);
      expect(result).toBeLessThan(100);
    });

    it(`findMany with equality filter p95 < 100 ms (${ITERATIONS} iterations)`, async () => {
      const repo = makeRepo();
      const samples: number[] = [];
      const categories = ['alpha', 'beta', 'gamma', 'delta', 'epsilon'];
      for (let i = 0; i < ITERATIONS; i++) {
        const cat = categories[i % categories.length] ?? 'alpha';
        const { ms } = await time(() =>
          repo.findMany({ filter: { category: { _eq: cat } }, page: { limit: 50, offset: 0 } }),
        );
        samples.push(ms);
      }
      const result = p95(samples);
      process.stdout.write(`  findMany+filter p95: ${result.toFixed(2)} ms\n`);
      expect(result).toBeLessThan(100);
    });

    it(`create p95 < 100 ms (${ITERATIONS} iterations)`, async () => {
      const repo = makeRepo();
      const samples: number[] = [];
      for (let i = 0; i < ITERATIONS; i++) {
        const id = `perf_create_${String(i).padStart(4, '0')}`;
        const { ms } = await time(() =>
          repo.create({ id, name: `Perf ${String(i)}`, category: 'alpha', score: i }),
        );
        samples.push(ms);
      }
      const result = p95(samples);
      process.stdout.write(`  create p95: ${result.toFixed(2)} ms\n`);
      expect(result).toBeLessThan(100);
    });

    it('bulk create 1000 rows p95 < 5000 ms (5 iterations)', async () => {
      const repo = makeRepo();
      const samples: number[] = [];
      const BULK_ITERS = 5;
      for (let b = 0; b < BULK_ITERS; b++) {
        const rows = Array.from({ length: 1000 }, (_, i) => ({
          id: `bulk_perf_${String(b)}_${String(i).padStart(4, '0')}`,
          name: `Bulk ${String(b)}-${String(i)}`,
          category: 'alpha',
          score: i,
        }));
        const { ms } = await time(() => repo.bulkCreate(rows));
        samples.push(ms);
      }
      const result = p95(samples);
      process.stdout.write(`  bulk create 1000 rows p95: ${result.toFixed(2)} ms\n`);
      expect(result).toBeLessThan(5000);
    });
  },
);
