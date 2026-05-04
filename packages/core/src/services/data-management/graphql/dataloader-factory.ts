import type { CustomerRow, Filter } from '@platform/ports-persistence';

import DataLoader from 'dataloader';

import type { PerWorkspaceRepositoryFactory } from '../per-workspace-repository-factory.js';
import type { CustomerSchema } from '../schema-model.js';

// ── Per-request DataLoader registry ───────────────────────────────────────────
//
// One DataLoaderFactory instance lives for the lifetime of the application.
// For each GraphQL request, forRequest() returns a fresh RequestLoaders set.
// Two loader types per table:
//   byId         — batches findById calls into one IN-clause query
//   byForeignKey — batches FK-column lookups into one IN-clause query

export interface RequestLoaders {
  byId<T>(tableId: string): DataLoader<string, T | null>;
  byForeignKey<T>(tableId: string, fkColumn: string): DataLoader<string, T[]>;
}

export class DataLoaderFactory {
  forRequest(
    workspaceSlug: string,
    schema: CustomerSchema,
    repos: PerWorkspaceRepositoryFactory,
  ): RequestLoaders {
    const byIdLoaders = new Map<string, DataLoader<string, unknown>>();
    const byFkLoaders = new Map<string, DataLoader<string, unknown[]>>();

    function getOrCreateById<T>(tableId: string): DataLoader<string, T | null> {
      const existing = byIdLoaders.get(tableId);
      if (existing) return existing as DataLoader<string, T | null>;

      const loader = new DataLoader<string, T | null>(
        async (ids) => {
          const repoResult = repos.getRepository(workspaceSlug, schema, tableId);
          if (repoResult.isErr()) return ids.map(() => null);
          const repo = repoResult.value;

          // Batch all IDs into a single IN-clause query
          const filterIn = { id: { _in: [...ids] } } as unknown as Filter<CustomerRow>;
          const result = await repo.findMany({
            filter: filterIn,
            page: { limit: ids.length, offset: 0 },
          });

          if (result.isErr()) return ids.map(() => null);

          const rowMap = new Map<string, T>();
          for (const row of result.value.items) {
            rowMap.set(String(row['id']), row as T);
          }

          return ids.map((id) => rowMap.get(id) ?? null);
        },
        { maxBatchSize: 500 },
      );

      byIdLoaders.set(tableId, loader as DataLoader<string, unknown>);
      return loader;
    }

    function getOrCreateByFk<T>(tableId: string, fkColumn: string): DataLoader<string, T[]> {
      const key = `${tableId}:${fkColumn}`;
      const existing = byFkLoaders.get(key);
      if (existing) return existing as DataLoader<string, T[]>;

      const loader = new DataLoader<string, T[]>(
        async (fkValues) => {
          const repoResult = repos.getRepository(workspaceSlug, schema, tableId);
          if (repoResult.isErr()) return fkValues.map(() => []);
          const repo = repoResult.value;

          const filterIn = { [fkColumn]: { _in: [...fkValues] } } as unknown as Filter<CustomerRow>;
          const result = await repo.findMany({
            filter: filterIn,
            // Reasonable upper bound: up to 100 rows per FK value in the batch
            page: { limit: fkValues.length * 100, offset: 0 },
          });

          if (result.isErr()) return fkValues.map(() => []);

          const rowsByFk = new Map<string, T[]>();
          for (const row of result.value.items) {
            const raw = row[fkColumn];
            const fkVal = typeof raw === 'string' || typeof raw === 'number' ? String(raw) : '';
            const bucket = rowsByFk.get(fkVal) ?? [];
            bucket.push(row as T);
            rowsByFk.set(fkVal, bucket);
          }

          return fkValues.map((fkVal) => rowsByFk.get(fkVal) ?? []);
        },
        { maxBatchSize: 200 },
      );

      byFkLoaders.set(key, loader as DataLoader<string, unknown[]>);
      return loader;
    }

    return {
      byId: getOrCreateById,
      byForeignKey: getOrCreateByFk,
    };
  }
}
