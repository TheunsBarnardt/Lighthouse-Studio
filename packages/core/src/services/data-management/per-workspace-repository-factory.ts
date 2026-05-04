import type { LoggerPort } from '@platform/ports-observability';
import type {
  CustomerRepositoryProviderPort,
  CustomerTableRepository,
} from '@platform/ports-persistence';
import type { Result } from 'neverthrow';

import { err, ok } from 'neverthrow';

import type { AppError } from '../../errors.js';
import type { CustomerSchema, CustomerTableDefinition } from './schema-model.js';

import { NotFoundError } from '../../errors.js';
import { customerNamespace } from './namespace.js';

// Cache key: workspaceSlug + tableId + schemaVersion.
// The version component means a schema deploy automatically invalidates stale repos.
type CacheKey = `${string}:${string}:v${number}`;

function makeCacheKey(workspaceSlug: string, tableId: string, schemaVersion: number): CacheKey {
  return `${workspaceSlug}:${tableId}:v${String(schemaVersion)}`;
}

function resolvePrimaryKeyColumn(table: CustomerTableDefinition): string {
  const pk = table.primaryKey;
  const columnId = pk.kind === 'composite' ? pk.columnIds[0] : pk.columnId;
  const col = table.columns.find((c) => c.id === columnId);
  return col?.name ?? 'id';
}

/**
 * Bridges schema metadata to the data plane. Builds and caches
 * CustomerTableRepository instances scoped to a workspace's database namespace.
 * A schema deploy increments the schema version which automatically busts the cache.
 */
export class PerWorkspaceRepositoryFactory {
  private readonly cache = new Map<CacheKey, CustomerTableRepository>();

  constructor(
    private readonly provider: CustomerRepositoryProviderPort,
    private readonly logger: LoggerPort,
  ) {}

  /**
   * Get (or build and cache) a repository for a specific table in a workspace.
   *
   * @param workspaceSlug - Workspace URL slug; used to compute the DB namespace.
   * @param schema - Customer schema containing the table definitions.
   * @param tableId - Stable table ID; survives column/name changes.
   */
  getRepository(
    workspaceSlug: string,
    schema: CustomerSchema,
    tableId: string,
  ): Result<CustomerTableRepository, AppError> {
    const table = schema.tables.find((t) => t.id === tableId);
    if (!table) {
      return err(new NotFoundError('CustomerTable', `${schema.slug}:${tableId}`));
    }

    const key = makeCacheKey(workspaceSlug, tableId, schema.version);
    const cached = this.cache.get(key);
    if (cached) {
      return ok(cached);
    }

    const repo = this.provider.buildRepository({
      // customerNamespace handles the driver difference:
      //   Postgres/MSSQL → "cust_<slug>"  (SQL schema name)
      //   Mongo          → "cust_<slug>__" (collection prefix)
      namespace: customerNamespace(workspaceSlug, schema.databaseDriver),
      tableName: table.name,
      columnNames: table.columns.map((c) => c.name),
      primaryKeyColumn: resolvePrimaryKeyColumn(table),
    });

    this.cache.set(key, repo);

    this.logger.debug('CustomerRepository built', {
      workspaceSlug,
      schemaId: schema.id,
      tableId,
      tableName: table.name,
      driver: schema.databaseDriver,
    });

    return ok(repo);
  }

  /**
   * Evict all cached repositories for a workspace.
   * Call after a schema deploy so subsequent requests see the new column definitions.
   */
  invalidate(workspaceSlug: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${workspaceSlug}:`)) {
        this.cache.delete(key);
      }
    }
    this.logger.debug('CustomerRepository cache invalidated', { workspaceSlug });
  }

  /**
   * Evict a single table's cache entries across all schema versions.
   * Call when a table is dropped or renamed.
   */
  invalidateTable(workspaceSlug: string, tableId: string): void {
    const prefix = `${workspaceSlug}:${tableId}:`;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }
}
