import { randomUUID } from 'node:crypto';

import { runPlatformVersionConformance } from '@platform/ports-platform-version/conformance';

import { MssqlPlatformVersionAdapter } from '../src/index.js';

// Simulates mssql ConnectionPool request().query() behaviour in-memory.
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

  const makeRequest = () => {
    const inputs: Record<string, unknown> = {};
    const req = {
      input: (name: string, value: unknown) => {
        inputs[name] = value;
        return req;
      },
      query: async (sql: string) => {
        const s = sql.trim().toUpperCase();

        if (s.includes('INSERT INTO') && s.includes('PLATFORM_VERSIONS')) {
          const row: Row = {
            id: randomUUID(),
            release_version: inputs['release_version'] as string,
            applied_at: new Date(),
            applied_by: (inputs['applied_by'] as string | null) ?? null,
            schema_migration_high_water:
              (inputs['schema_migration_high_water'] as string | null) ?? null,
            notes: (inputs['notes'] as string | null) ?? null,
          };
          rows.push(row);
          return { recordset: [], rowsAffected: [1] };
        }

        if (s.includes('DELETE FROM') && s.includes('PLATFORM_VERSIONS')) {
          const id = inputs['id'] as string;
          const idx = rows.findIndex((r) => r.id === id);
          if (idx !== -1) rows.splice(idx, 1);
          return { recordset: [], rowsAffected: [1] };
        }

        if (s.includes('SELECT') && s.includes('PLATFORM_VERSIONS')) {
          const sorted = [...rows].sort(
            (a, b) => b.applied_at.getTime() - a.applied_at.getTime(),
          );
          const isTop1 = s.includes('TOP 1');
          // CAST(id AS NVARCHAR(36)) AS id — return id as string (already is)
          const result = isTop1 ? sorted.slice(0, 1) : sorted;
          return { recordset: result, rowsAffected: [result.length] };
        }

        return { recordset: [], rowsAffected: [0] };
      },
    };
    return req;
  };

  return {
    request: () => makeRequest(),
  } as unknown as import('mssql').ConnectionPool;
}

runPlatformVersionConformance('MssqlPlatformVersionAdapter', async () => {
  return new MssqlPlatformVersionAdapter(makePool());
});
