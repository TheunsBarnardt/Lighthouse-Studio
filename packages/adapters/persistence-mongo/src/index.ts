export { createMongoConnection } from './connection.js';
export type { MongoConnectionConfig, MongoConnection } from './connection.js';

export { createMongoRepository } from './repository.adapter.js';
export type { MongoCollectionConfig, MongoRepositoryDeps } from './repository.adapter.js';

export { MongoUnitOfWork } from './unit-of-work.adapter.js';
export { MongoLockAdapter } from './lock.adapter.js';

export { MongoQueryAdapter } from './query.adapter.js';

export { MongoSchemaIntrospectionAdapter } from './schema-introspection.adapter.js';

export { MongoDdlAdapter } from './schema-ddl.adapter.js';

export { MongoMigrationRunner, checksumFile } from './migrate.js';
export type { MongoMigration } from './migrate.js';

export { translateFilter } from './filter-translator.js';
export type { FilterTranslationError } from './filter-translator.js';

export type { EntityMapper, FieldMap } from './mapper.js';
export { createFieldMapper } from './mapper.js';

export {
  MongoCustomerRepositoryProvider,
  ARCHIVE_FIELD as MONGO_CUSTOMER_ARCHIVE_FIELD,
} from './customer-repository.adapter.js';
