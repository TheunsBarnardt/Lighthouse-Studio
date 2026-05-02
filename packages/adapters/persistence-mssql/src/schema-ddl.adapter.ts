import type * as mssql from 'mssql';
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

// ── Type mapping: normalized → T-SQL ──────────────────────────────────────────

function platformTypeToMssql(t: PlatformColumnType): string {
  switch (t.kind) {
    case 'string':
      return t.length ? `NVARCHAR(${String(t.length)})` : 'NVARCHAR(255)';
    case 'text':
      return 'NVARCHAR(MAX)';
    case 'integer':
      return 'INT';
    case 'bigint':
      return 'BIGINT';
    case 'decimal':
      return `DECIMAL(${String(t.precision)}, ${String(t.scale)})`;
    case 'boolean':
      return 'BIT';
    case 'date':
      return 'DATE';
    case 'timestamp':
    case 'timestamp_tz':
      return 'DATETIME2(7)';
    case 'uuid':
      return 'UNIQUEIDENTIFIER';
    case 'binary':
      return 'VARBINARY(MAX)';
    case 'json':
      return 'NVARCHAR(MAX)';
    case 'array':
      throw new DdlError(
        'MSSQL does not support array columns. Declare capability array_columns: false.',
      );
  }
}

function quoteIdentifier(name: string): string {
  return `[${name.replace(/]/g, ']]')}]`;
}

function columnDdl(col: ColumnDefinition, tableName: string): string {
  if (col.type.kind === 'array') {
    throw new DdlError(
      `Column "${col.name}" in table "${tableName}" is an array type, which MSSQL does not support.`,
    );
  }

  const typeSql = platformTypeToMssql(col.type);
  const nullable = col.nullable ? 'NULL' : 'NOT NULL';
  const def = col.defaultValue
    ? ` CONSTRAINT [DF_${tableName}_${col.name}] DEFAULT ${col.defaultValue}`
    : '';

  const jsonCheck =
    col.type.kind === 'json'
      ? ` CONSTRAINT [CK_${tableName}_${col.name}_json] CHECK (ISJSON(${quoteIdentifier(col.name)}) = 1 OR ${quoteIdentifier(col.name)} IS NULL)`
      : '';

  return `  ${quoteIdentifier(col.name)} ${typeSql} ${nullable}${def}${jsonCheck}`;
}

function buildCreateIndexSql(index: IndexDefinition, schema: string, table: string): string {
  const fqTable = `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`;
  const unique = index.isUnique ? 'UNIQUE ' : '';
  const cols = index.columns.map(quoteIdentifier).join(', ');
  return `CREATE ${unique}INDEX ${quoteIdentifier(index.name)} ON ${fqTable} (${cols});`;
}

// ── Adapter ───────────────────────────────────────────────────────────────────

export class MssqlSchemaDdlAdapter implements SchemaDdlPort {
  constructor(private readonly pool: mssql.ConnectionPool) {}

  supports(feature: SchemaFeature): boolean {
    const supported: SchemaFeature[] = [
      'schemas',
      'foreign_keys',
      'check_constraints',
      'json_columns',
      'unique_indexes',
      'transactions',
    ];
    return supported.includes(feature);
  }

  validate(definition: TableDefinition): Result<void, DdlError> {
    if (!definition.name) {
      return err(new DdlError('Table name is required'));
    }
    if (definition.columns.length === 0) {
      return err(new DdlError(`Table "${definition.name}" must have at least one column`));
    }
    for (const col of definition.columns) {
      if (col.type.kind === 'array') {
        return err(
          new DdlError(
            `Column "${col.name}" in table "${definition.name}" is an array type, which MSSQL does not support.`,
          ),
        );
      }
    }
    return ok(undefined);
  }

  createTable(definition: TableDefinition): Result<DdlStatement[], DdlError> {
    try {
      const validateResult = this.validate(definition);
      if (validateResult.isErr()) return err(validateResult.error);

      const schema = definition.schema ?? 'dbo';
      const fqTable = `${quoteIdentifier(schema)}.${quoteIdentifier(definition.name)}`;

      const colLines = definition.columns.map((c) => columnDdl(c, definition.name));

      const pkCols = definition.columns.filter((c) => c.isPrimaryKey);
      if (pkCols.length > 0) {
        const pkList = pkCols.map((c) => quoteIdentifier(c.name)).join(', ');
        colLines.push(`  CONSTRAINT [PK_${definition.name}] PRIMARY KEY CLUSTERED (${pkList})`);
      }

      for (const c of definition.constraints.filter((c) => c.type === 'UNIQUE')) {
        const cols = (c.columns ?? []).map(quoteIdentifier).join(', ');
        colLines.push(`  CONSTRAINT ${quoteIdentifier(c.name)} UNIQUE (${cols})`);
      }

      for (const c of definition.constraints.filter((c) => c.type === 'CHECK' && c.expression)) {
        colLines.push(`  CONSTRAINT ${quoteIdentifier(c.name)} CHECK (${c.expression ?? ''})`);
      }

      for (const fk of definition.foreignKeys) {
        const cols = fk.columns.map(quoteIdentifier).join(', ');
        const refTable = fk.referencedSchema
          ? `${quoteIdentifier(fk.referencedSchema)}.${quoteIdentifier(fk.referencedTable)}`
          : quoteIdentifier(fk.referencedTable);
        const refCols = fk.referencedColumns.map(quoteIdentifier).join(', ');
        const onDel = fk.onDelete ? ` ON DELETE ${fk.onDelete}` : '';
        const onUpd = fk.onUpdate ? ` ON UPDATE ${fk.onUpdate}` : '';
        colLines.push(
          `  CONSTRAINT ${quoteIdentifier(fk.name)} FOREIGN KEY (${cols}) REFERENCES ${refTable} (${refCols})${onDel}${onUpd}`,
        );
      }

      const tableComment = definition.comment ? `-- ${definition.comment}\n` : '';
      const createSql = `${tableComment}CREATE TABLE ${fqTable} (\n${colLines.join(',\n')}\n);`;
      const reverseSql = `DROP TABLE IF EXISTS ${fqTable};`;

      const statements: DdlStatement[] = [{ sql: createSql, reverseSql }];

      for (const idx of definition.indexes) {
        const idxResult = this.createIndex(idx, schema, definition.name);
        if (idxResult.isErr()) return err(idxResult.error);
        statements.push(...idxResult.value);
      }

      return ok(statements);
    } catch (e) {
      if (e instanceof DdlError) return err(e);
      return err(new DdlError(`DDL generation failed: ${String(e)}`, e));
    }
  }

  alterTable(from: TableDefinition, to: TableDefinition): Result<DdlStatement[], DdlError> {
    try {
      const validateResult = this.validate(to);
      if (validateResult.isErr()) return err(validateResult.error);

      const schema = to.schema ?? 'dbo';
      const fqTable = `${quoteIdentifier(schema)}.${quoteIdentifier(to.name)}`;
      const statements: DdlStatement[] = [];

      const fromCols = new Map(from.columns.map((c) => [c.name, c]));
      const toCols = new Map(to.columns.map((c) => [c.name, c]));

      for (const [name, col] of toCols) {
        if (!fromCols.has(name)) {
          const colSql = columnDdl(col, to.name).trim();
          statements.push({
            sql: `ALTER TABLE ${fqTable} ADD ${colSql};`,
            reverseSql: `ALTER TABLE ${fqTable} DROP COLUMN ${quoteIdentifier(name)};`,
          });
        }
      }

      for (const [name] of fromCols) {
        if (!toCols.has(name)) {
          statements.push({ sql: `ALTER TABLE ${fqTable} DROP COLUMN ${quoteIdentifier(name)};` });
        }
      }

      const fromIndexNames = new Set(from.indexes.map((i) => i.name));
      for (const idx of to.indexes) {
        if (!fromIndexNames.has(idx.name)) {
          const idxResult = this.createIndex(idx, schema, to.name);
          if (idxResult.isErr()) return err(idxResult.error);
          statements.push(...idxResult.value);
        }
      }

      const toIndexNames = new Set(to.indexes.map((i) => i.name));
      for (const idx of from.indexes) {
        if (!toIndexNames.has(idx.name)) {
          const dropResult = this.dropIndex(idx.name, schema);
          if (dropResult.isErr()) return err(dropResult.error);
          statements.push(...dropResult.value);
        }
      }

      return ok(statements);
    } catch (e) {
      if (e instanceof DdlError) return err(e);
      return err(new DdlError(`ALTER TABLE generation failed: ${String(e)}`, e));
    }
  }

  dropTable(
    schema: string,
    table: string,
    opts?: { ifExists?: boolean },
  ): Result<DdlStatement[], DdlError> {
    const ifExists = opts?.ifExists !== false ? 'IF EXISTS ' : '';
    const fqTable = `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`;
    return ok([{ sql: `DROP TABLE ${ifExists}${fqTable};` }]);
  }

  createIndex(
    index: IndexDefinition,
    schema: string,
    table: string,
  ): Result<DdlStatement[], DdlError> {
    if (index.columns.length === 0) {
      return err(new DdlError(`Index "${index.name}" must have at least one column`));
    }
    const fqTable = `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`;
    const unique = index.isUnique ? 'UNIQUE ' : '';
    const cols = index.columns.map(quoteIdentifier).join(', ');
    const sql = `CREATE ${unique}INDEX ${quoteIdentifier(index.name)} ON ${fqTable} (${cols});`;
    const reverseSql = `DROP INDEX ${quoteIdentifier(index.name)} ON ${fqTable};`;
    return ok([{ sql, reverseSql }]);
  }

  dropIndex(indexName: string, schema?: string): Result<DdlStatement[], DdlError> {
    // MSSQL requires the table name for DROP INDEX, which the port interface doesn't provide.
    // Use dynamic SQL to look up the table from sys.indexes at execution time.
    const safeName = indexName.replace(/'/g, "''");
    const schemaFilter = schema ? `AND s.name = '${schema.replace(/'/g, "''")}'` : '';
    const sql = [
      'DECLARE @__sql NVARCHAR(MAX);',
      `SELECT @__sql = 'DROP INDEX ' + QUOTENAME(i.name) + ' ON ' + QUOTENAME(s.name) + '.' + QUOTENAME(t.name)`,
      'FROM sys.indexes i',
      'JOIN sys.tables t ON i.object_id = t.object_id',
      'JOIN sys.schemas s ON t.schema_id = s.schema_id',
      `WHERE i.name = '${safeName}' ${schemaFilter};`,
      'IF @__sql IS NOT NULL EXEC(@__sql);',
    ].join('\n');
    return ok([{ sql }]);
  }

  async executeStatement(statement: DdlStatement): Promise<Result<void, DdlError>> {
    try {
      await this.pool.request().query(statement.sql);
      return ok(undefined);
    } catch (e) {
      return err(new DdlError(`DDL execution failed: ${String(e)}`, e));
    }
  }

  generateCreateIndexes(tableName: string, schema: string, indexes: IndexDefinition[]): string[] {
    return indexes.map((idx) => buildCreateIndexSql(idx, schema, tableName));
  }
}
