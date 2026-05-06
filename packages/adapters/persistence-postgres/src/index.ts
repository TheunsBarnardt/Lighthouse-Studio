export { createConnectionPools } from './connection.js';
export type { ConnectionConfig, ConnectionPools } from './connection.js';

export { createPostgresRepository } from './repository.adapter.js';
export type { PostgresTableConfig, PostgresRepositoryDeps } from './repository.adapter.js';

export { PostgresUnitOfWork } from './unit-of-work.adapter.js';
export { PostgresLockAdapter } from './lock.adapter.js';

export { PostgresQueryAdapter } from './query.adapter.js';

export { PostgresSchemaIntrospectionAdapter } from './schema-introspection.adapter.js';

export { PostgresSchemaDdlAdapter } from './schema-ddl.adapter.js';

export { PostgresMigrationRunner, runMigrations, checksumSql } from './migrate.js';

export { PostgresFullTextSearchAdapter } from './search.adapter.js';

export { PostgresVectorStoreAdapter } from './vectorstore.adapter.js';

export { translateFilter } from './filter-translator.js';
export type { TranslatedFilter, FilterTranslationError } from './filter-translator.js';

export type { EntityMapper, FieldMap } from './mapper.js';
export { createFieldMapper } from './mapper.js';

export { standardColumns, tenantColumns } from './schema/_common.js';

export {
  PostgresCustomerRepositoryProvider,
  ARCHIVE_COL as PG_CUSTOMER_ARCHIVE_COL,
} from './customer-repository.adapter.js';

export { PostgresWorkspaceAssetAdapter } from './workspace-asset.adapter.js';

export { PostgresRawQueryAdapter } from './raw-query.adapter.js';
export type { RawQueryPools } from './raw-query.adapter.js';

export { PostgresAiCacheAdapter } from './ai-cache.adapter.js';
