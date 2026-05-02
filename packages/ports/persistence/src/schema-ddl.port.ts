import type { Result } from 'neverthrow';

import type { DdlError } from './errors.js';
import type { DdlStatement, IndexDefinition, SchemaFeature, TableDefinition } from './types.js';

export interface SchemaDdlPort {
  createTable(definition: TableDefinition): Result<DdlStatement[], DdlError>;

  alterTable(from: TableDefinition, to: TableDefinition): Result<DdlStatement[], DdlError>;

  dropTable(
    schema: string,
    table: string,
    opts?: { ifExists?: boolean },
  ): Result<DdlStatement[], DdlError>;

  createIndex(
    index: IndexDefinition,
    schema: string,
    table: string,
  ): Result<DdlStatement[], DdlError>;

  dropIndex(indexName: string, schema?: string): Result<DdlStatement[], DdlError>;

  validate(definition: TableDefinition): Result<void, DdlError>;

  supports(feature: SchemaFeature): boolean;
}
