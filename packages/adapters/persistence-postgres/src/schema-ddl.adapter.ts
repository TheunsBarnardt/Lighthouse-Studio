import type { Result } from 'neverthrow';

import {
  DdlError,
  type ColumnDefinition,
  type DdlStatement,
  type IndexDefinition,
  type PlatformColumnType,
  type SchemaFeature,
  type SchemaDdlPort,
  type TableDefinition,
} from '@platform/ports-persistence';
import { err, ok } from 'neverthrow';

// ── Type mapping: normalized → Postgres ───────────────────────────────────────

const PG_RESERVED_KEYWORDS = new Set([
  'all',
  'analyse',
  'analyze',
  'and',
  'any',
  'array',
  'as',
  'asc',
  'asymmetric',
  'authorization',
  'binary',
  'both',
  'case',
  'cast',
  'check',
  'collate',
  'column',
  'constraint',
  'create',
  'cross',
  'current_catalog',
  'current_date',
  'current_role',
  'current_schema',
  'current_time',
  'current_timestamp',
  'current_user',
  'default',
  'deferrable',
  'desc',
  'distinct',
  'do',
  'else',
  'end',
  'except',
  'false',
  'fetch',
  'for',
  'foreign',
  'from',
  'full',
  'grant',
  'group',
  'having',
  'ilike',
  'in',
  'initially',
  'inner',
  'intersect',
  'into',
  'is',
  'isnull',
  'join',
  'lateral',
  'leading',
  'left',
  'like',
  'limit',
  'localtime',
  'localtimestamp',
  'natural',
  'not',
  'notnull',
  'null',
  'offset',
  'on',
  'only',
  'or',
  'order',
  'outer',
  'overlaps',
  'placing',
  'primary',
  'references',
  'returning',
  'right',
  'select',
  'session_user',
  'similar',
  'some',
  'symmetric',
  'table',
  'tablesample',
  'then',
  'to',
  'trailing',
  'true',
  'union',
  'unique',
  'user',
  'using',
  'variadic',
  'verbose',
  'when',
  'where',
  'window',
  'with',
]);

function toPgType(type: PlatformColumnType): string {
  switch (type.kind) {
    case 'string':
      return type.length ? `VARCHAR(${String(type.length)})` : 'VARCHAR(255)';
    case 'text':
      return 'TEXT';
    case 'integer':
      return 'INTEGER';
    case 'bigint':
      return 'BIGINT';
    case 'decimal':
      return `NUMERIC(${String(type.precision)}, ${String(type.scale)})`;
    case 'boolean':
      return 'BOOLEAN';
    case 'date':
      return 'DATE';
    case 'timestamp':
      return 'TIMESTAMP WITHOUT TIME ZONE';
    case 'timestamp_tz':
      return 'TIMESTAMP WITH TIME ZONE';
    case 'uuid':
      return 'UUID';
    case 'binary':
      return 'BYTEA';
    case 'json':
      return 'JSONB';
    case 'array':
      return `${toPgType(type.elementType)}[]`;
    default:
      return 'TEXT';
  }
}

// ── Validation helpers ────────────────────────────────────────────────────────

function validateColumnName(name: string): DdlError | null {
  if (name.length > 63) {
    return new DdlError(`Column name "${name}" exceeds Postgres 63-character limit`);
  }
  if (PG_RESERVED_KEYWORDS.has(name.toLowerCase())) {
    return new DdlError(
      `Column name "${name}" is a reserved keyword — quote it or choose a different name`,
    );
  }
  return null;
}

// ── Column DDL ────────────────────────────────────────────────────────────────

function columnDdl(col: ColumnDefinition): string {
  const type = toPgType(col.type);
  const nullable = col.nullable ? '' : ' NOT NULL';
  const def = col.defaultValue ? ` DEFAULT ${col.defaultValue}` : '';
  const unique = col.isUnique && !col.isPrimaryKey ? ' UNIQUE' : '';
  return `  "${col.name}" ${type}${nullable}${def}${unique}`;
}

// ── Adapter ───────────────────────────────────────────────────────────────────

export class PostgresSchemaDdlAdapter implements SchemaDdlPort {
  createTable(definition: TableDefinition): Result<DdlStatement[], DdlError> {
    const validateResult = this.validate(definition);
    if (validateResult.isErr()) return err(validateResult.error);

    const schema = definition.schema ?? 'public';
    const fqTable = `"${schema}"."${definition.name}"`;

    const colDdls = definition.columns.map(columnDdl);
    const pkCols = definition.columns.filter((c) => c.isPrimaryKey);

    if (pkCols.length > 0) {
      const pkList = pkCols.map((c) => `"${c.name}"`).join(', ');
      colDdls.push(`  PRIMARY KEY (${pkList})`);
    }

    if (definition.foreignKeys.length > 0) {
      for (const fk of definition.foreignKeys) {
        const cols = fk.columns.map((c) => `"${c}"`).join(', ');
        const refSchema = fk.referencedSchema ?? 'public';
        const refCols = fk.referencedColumns.map((c) => `"${c}"`).join(', ');
        const onDelete = fk.onDelete ? ` ON DELETE ${fk.onDelete}` : '';
        const onUpdate = fk.onUpdate ? ` ON UPDATE ${fk.onUpdate}` : '';
        colDdls.push(
          `  CONSTRAINT "${fk.name}" FOREIGN KEY (${cols}) REFERENCES "${refSchema}"."${fk.referencedTable}" (${refCols})${onDelete}${onUpdate}`,
        );
      }
    }

    for (const c of definition.constraints) {
      if (c.type === 'CHECK' && c.expression) {
        colDdls.push(`  CONSTRAINT "${c.name}" CHECK (${c.expression})`);
      }
    }

    const createSql = `CREATE TABLE ${fqTable} (\n${colDdls.join(',\n')}\n);`;
    const dropSql = `DROP TABLE IF EXISTS ${fqTable};`;

    const statements: DdlStatement[] = [{ sql: createSql, reverseSql: dropSql }];

    // CREATE INDEX statements (separate for readability; functionally identical to inline)
    for (const idx of definition.indexes) {
      const idxResult = this.createIndex(idx, schema, definition.name);
      if (idxResult.isErr()) return err(idxResult.error);
      statements.push(...idxResult.value);
    }

    return ok(statements);
  }

  alterTable(from: TableDefinition, to: TableDefinition): Result<DdlStatement[], DdlError> {
    const validateResult = this.validate(to);
    if (validateResult.isErr()) return err(validateResult.error);

    const schema = to.schema ?? 'public';
    const fqTable = `"${schema}"."${to.name}"`;
    const statements: DdlStatement[] = [];

    const fromCols = new Map(from.columns.map((c) => [c.name, c]));
    const toCols = new Map(to.columns.map((c) => [c.name, c]));

    // Add new columns
    for (const [name, col] of toCols) {
      if (!fromCols.has(name)) {
        const sql = `ALTER TABLE ${fqTable} ADD COLUMN ${columnDdl(col).trim()};`;
        const reverseSql = `ALTER TABLE ${fqTable} DROP COLUMN IF EXISTS "${name}";`;
        statements.push({ sql, reverseSql });
      }
    }

    // Drop removed columns (destructive — caller must confirm)
    for (const [name] of fromCols) {
      if (!toCols.has(name)) {
        const sql = `ALTER TABLE ${fqTable} DROP COLUMN IF EXISTS "${name}";`;
        statements.push({ sql });
      }
    }

    // Add new indexes
    const fromIndexNames = new Set(from.indexes.map((i) => i.name));
    for (const idx of to.indexes) {
      if (!fromIndexNames.has(idx.name)) {
        const idxResult = this.createIndex(idx, schema, to.name);
        if (idxResult.isErr()) return err(idxResult.error);
        statements.push(...idxResult.value);
      }
    }

    // Drop removed indexes
    const toIndexNames = new Set(to.indexes.map((i) => i.name));
    for (const idx of from.indexes) {
      if (!toIndexNames.has(idx.name)) {
        const dropResult = this.dropIndex(idx.name, schema);
        if (dropResult.isErr()) return err(dropResult.error);
        statements.push(...dropResult.value);
      }
    }

    return ok(statements);
  }

  dropTable(
    schema: string,
    table: string,
    opts?: { ifExists?: boolean },
  ): Result<DdlStatement[], DdlError> {
    const ifExists = opts?.ifExists ? 'IF EXISTS ' : '';
    const sql = `DROP TABLE ${ifExists}"${schema}"."${table}";`;
    return ok([{ sql }]);
  }

  createIndex(
    index: IndexDefinition,
    schema: string,
    table: string,
  ): Result<DdlStatement[], DdlError> {
    if (index.columns.length === 0) {
      return err(new DdlError(`Index "${index.name}" must have at least one column`));
    }
    const unique = index.isUnique ? 'UNIQUE ' : '';
    const method = index.method ? ` USING ${index.method.toUpperCase()}` : '';
    const cols = index.columns.map((c) => `"${c}"`).join(', ');
    const where = index.predicate ? ` WHERE ${index.predicate}` : '';
    const sql = `CREATE ${unique}INDEX CONCURRENTLY IF NOT EXISTS "${index.name}" ON "${schema}"."${table}"${method} (${cols})${where};`;
    const reverseSql = `DROP INDEX CONCURRENTLY IF EXISTS "${schema}"."${index.name}";`;
    return ok([{ sql, reverseSql }]);
  }

  dropIndex(indexName: string, schema?: string): Result<DdlStatement[], DdlError> {
    const fqIndex = schema ? `"${schema}"."${indexName}"` : `"${indexName}"`;
    return ok([{ sql: `DROP INDEX CONCURRENTLY IF EXISTS ${fqIndex};` }]);
  }

  validate(definition: TableDefinition): Result<void, DdlError> {
    if (definition.name.length > 63) {
      return err(
        new DdlError(`Table name "${definition.name}" exceeds Postgres 63-character limit`),
      );
    }
    if (definition.columns.length === 0) {
      return err(new DdlError(`Table "${definition.name}" must have at least one column`));
    }
    const hasPk = definition.columns.some((c) => c.isPrimaryKey);
    if (!hasPk) {
      return err(new DdlError(`Table "${definition.name}" must have a primary key`));
    }
    for (const col of definition.columns) {
      const colErr = validateColumnName(col.name);
      if (colErr) return err(colErr);
    }
    return ok(undefined);
  }

  supports(feature: SchemaFeature): boolean {
    switch (feature) {
      case 'schemas':
        return true;
      case 'foreign_keys':
        return true;
      case 'check_constraints':
        return true;
      case 'json_columns':
        return true;
      case 'array_columns':
        return true;
      case 'partial_indexes':
        return true;
      case 'unique_indexes':
        return true;
      case 'spatial_indexes':
        return false; // requires PostGIS; checked at runtime
      case 'transactions':
        return true;
      case 'change_streams':
        return true;
      default:
        return false;
    }
  }
}
