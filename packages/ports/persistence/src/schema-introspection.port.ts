import type { Result } from 'neverthrow';

import type { PersistenceError } from './errors.js';
import type {
  ConstraintInfo,
  ForeignKeyInfo,
  IndexInfo,
  SchemaFeature,
  SchemaInfo,
  TableDefinition,
  TableInfo,
} from './types.js';

export interface SchemaIntrospectionPort {
  listSchemas(): Promise<Result<SchemaInfo[], PersistenceError>>;
  listTables(schema?: string): Promise<Result<TableInfo[], PersistenceError>>;
  describeTable(schema: string, table: string): Promise<Result<TableDefinition, PersistenceError>>;
  listIndexes(schema: string, table: string): Promise<Result<IndexInfo[], PersistenceError>>;
  listForeignKeys(
    schema: string,
    table: string,
  ): Promise<Result<ForeignKeyInfo[], PersistenceError>>;
  listConstraints(
    schema: string,
    table: string,
  ): Promise<Result<ConstraintInfo[], PersistenceError>>;

  supports(feature: SchemaFeature): boolean;
}
