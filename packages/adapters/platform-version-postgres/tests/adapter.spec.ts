import { randomUUID } from 'node:crypto';

import { runPlatformVersionConformance } from '@platform/ports-platform-version/conformance';

import { PostgresPlatformVersionAdapter } from '../src/index.js';

// Simulates pg Pool query behaviour in-memory so tests run without a real DB.
function makePool() {
  interface Row {
    id: string;
    release_version: string;
    applied_at: Date;
    applied_by: string | null;
    schema_migration_high_water: string | null;
    notes: string | null;
  }

  const rows: Row[] = [];

  const makeClient = () => {
    let inTx = false;
    const client = {
      query: async (sql: string, params?: unknown[]) => {
        const s = sql.trim().toUpperCase();
        if (s.startsWith('BEGIN')) {
          inTx = true;
          return { rows: [], rowCount: 0 };
        }
        if (s.startsWith('COMMIT') || s.startsWith('ROLLBACK')) {
          inTx = false;
          return { rows: [], rowCount: 0 };
        }
        return pool.query(sql, params);
      },
      release: () => undefined,
    };
    return client;
  };

  const pool = {
    query: async (sql: string, params?: unknown[]) => {
      const s = sql.trim().toUpperCase();

      if (s.includes('INSERT INTO PLATFORM_VERSIONS')) {
        const row: Row = {
          id: randomUUID(),
          release_version: params![0] as string,
          applied_at: new Date(),
          applied_by: (params![1] as string | null) ?? null,
          schema_migration_high_water: (params![2] as string | null) ?? null,
          notes: (params![3] as string | null) ?? null,
        };
        rows.push(row);
        return { rows: [], rowCount: 1 };
      }

      if (s.includes('DELETE FROM PLATFORM_VERSIONS WHERE ID')) {
        const id = params![0] as string;
        const idx = rows.findIndex((r) => r.id === id);
        if (idx !== -1) rows.splice(idx, 1);
        return { rows: [], rowCount: 1 };
      }

      if (s.includes('SELECT') && s.includes('FROM PLATFORM_VERSIONS')) {
        const sorted = [...rows].sort(
          (a, b) => b.applied_at.getTime() - a.applied_at.getTime(),
        );
        const isLimit1 = s.includes('LIMIT 1');
        const result = isLimit1 ? sorted.slice(0, 1) : sorted;
        return { rows: result, rowCount: result.length };
      }

      return { rows: [], rowCount: 0 };
    },
    connect: async () => makeClient(),
  };

  return pool as unknown as import('pg').Pool;
}

runPlatformVersionConformance('PostgresPlatformVersionAdapter', async () => {
  return new PostgresPlatformVersionAdapter(makePool());
});
