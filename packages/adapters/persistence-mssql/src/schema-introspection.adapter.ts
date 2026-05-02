import type * as mssql from 'mssql';
import type { Result } from 'neverthrow';

import {
  PersistenceError,
  type ColumnDefinition,
  type ConstraintInfo,
  type ForeignKeyInfo,
  type IndexInfo,
  type PlatformColumnType,
  type SchemaFeature,
  type SchemaInfo,
  type SchemaIntrospectionPort,
  type TableDefinition,
  type TableInfo,
} from '@platform/ports-persistence';
import { err, ok } from 'neverthrow';

// ── MSSQL → platform type mapping ────────────────────────────────────────────

function mapMssqlType(
  dataType: string,
  charLen: number | null,
  precision: number | null,
  scale: number | null,
): PlatformColumnType {
  switch (dataType.toLowerCase()) {
    case 'char':
    case 'nchar':
    case 'varchar':
    case 'nvarchar':
      if (charLen === -1) return { kind: 'text' };
      return charLen != null ? { kind: 'string', length: charLen } : { kind: 'string' };
    case 'text':
    case 'ntext':
      return { kind: 'text' };
    case 'int':
    case 'smallint':
    case 'tinyint':
      return { kind: 'integer' };
    case 'bigint':
      return { kind: 'bigint' };
    case 'decimal':
    case 'numeric':
      return { kind: 'decimal', precision: precision ?? 18, scale: scale ?? 0 };
    case 'bit':
      return { kind: 'boolean' };
    case 'date':
      return { kind: 'date' };
    case 'datetime':
    case 'datetime2':
    case 'smalldatetime':
      return { kind: 'timestamp_tz' };
    case 'datetimeoffset':
      return { kind: 'timestamp_tz' };
    case 'uniqueidentifier':
      return { kind: 'uuid' };
    case 'binary':
    case 'varbinary':
    case 'image':
    case 'rowversion':
    case 'timestamp':
      return { kind: 'binary' };
    default:
      return { kind: 'text' };
  }
}

export class MssqlSchemaIntrospectionAdapter implements SchemaIntrospectionPort {
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

  async listSchemas(): Promise<Result<SchemaInfo[], PersistenceError>> {
    try {
      const res = await this.pool.request().query(
        `SELECT [name] FROM sys.schemas
         WHERE [name] NOT IN ('sys','INFORMATION_SCHEMA','guest','db_owner',
           'db_accessadmin','db_securityadmin','db_ddladmin','db_backupoperator',
           'db_datareader','db_datawriter','db_denydatareader','db_denydatawriter')
         ORDER BY [name]`,
      );
      const schemas = (res.recordset as { name: string }[]).map((r) => ({ name: r.name }));
      return ok(schemas);
    } catch (e) {
      return err(new PersistenceError('UNKNOWN', `Failed to list schemas: ${String(e)}`, e));
    }
  }

  async listTables(schema?: string): Promise<Result<TableInfo[], PersistenceError>> {
    try {
      const req = this.pool.request();
      let sql = `SELECT t.[TABLE_SCHEMA] AS [schema], t.[TABLE_NAME] AS [name],
                   t.[TABLE_TYPE] AS [type],
                   p.[rows] AS [row_count]
                 FROM INFORMATION_SCHEMA.TABLES t
                 LEFT JOIN sys.partitions p
                   ON p.[object_id] = OBJECT_ID(t.[TABLE_SCHEMA] + '.' + t.[TABLE_NAME])
                   AND p.index_id IN (0,1)`;
      if (schema) {
        req.input('schema', schema);
        sql += ` WHERE t.[TABLE_SCHEMA] = @schema`;
      }
      sql += ` ORDER BY t.[TABLE_SCHEMA], t.[TABLE_NAME]`;
      const res = await req.query(sql);
      const tables: TableInfo[] = (
        res.recordset as {
          schema: string;
          name: string;
          type: string;
          row_count: number | null;
        }[]
      ).map((r) => ({
        schema: r.schema,
        name: r.name,
        type: r.type === 'VIEW' ? ('view' as const) : ('table' as const),
        ...(r.row_count != null ? { rowCount: r.row_count } : {}),
      }));
      return ok(tables);
    } catch (e) {
      return err(new PersistenceError('UNKNOWN', `Failed to list tables: ${String(e)}`, e));
    }
  }

  async describeTable(
    schema: string,
    table: string,
  ): Promise<Result<TableDefinition, PersistenceError>> {
    try {
      const req = this.pool.request();
      req.input('table', table);
      req.input('schema', schema);
      const res = await req.query(`
        SELECT
          c.COLUMN_NAME AS name,
          c.DATA_TYPE AS data_type,
          c.CHARACTER_MAXIMUM_LENGTH AS char_len,
          c.NUMERIC_PRECISION AS num_precision,
          c.NUMERIC_SCALE AS num_scale,
          c.IS_NULLABLE AS is_nullable,
          c.COLUMN_DEFAULT AS col_default,
          CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END AS is_pk,
          CASE WHEN uq.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END AS is_unique
        FROM INFORMATION_SCHEMA.COLUMNS c
        LEFT JOIN (
          SELECT ku.TABLE_SCHEMA, ku.TABLE_NAME, ku.COLUMN_NAME
          FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
          JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku
            ON tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
          WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
        ) pk ON pk.TABLE_SCHEMA = c.TABLE_SCHEMA AND pk.TABLE_NAME = c.TABLE_NAME AND pk.COLUMN_NAME = c.COLUMN_NAME
        LEFT JOIN (
          SELECT ku.TABLE_SCHEMA, ku.TABLE_NAME, ku.COLUMN_NAME
          FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
          JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku
            ON tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
          WHERE tc.CONSTRAINT_TYPE = 'UNIQUE'
        ) uq ON uq.TABLE_SCHEMA = c.TABLE_SCHEMA AND uq.TABLE_NAME = c.TABLE_NAME AND uq.COLUMN_NAME = c.COLUMN_NAME
        WHERE c.TABLE_NAME = @table AND c.TABLE_SCHEMA = @schema
        ORDER BY c.ORDINAL_POSITION
      `);

      const columns: ColumnDefinition[] = (
        res.recordset as {
          name: string;
          data_type: string;
          char_len: number | null;
          num_precision: number | null;
          num_scale: number | null;
          is_nullable: string;
          col_default: string | null;
          is_pk: number;
          is_unique: number;
        }[]
      ).map((r) => ({
        name: r.name,
        type: mapMssqlType(r.data_type, r.char_len, r.num_precision, r.num_scale),
        nullable: r.is_nullable === 'YES',
        isPrimaryKey: r.is_pk === 1,
        isUnique: r.is_unique === 1,
        ...(r.col_default != null ? { defaultValue: r.col_default } : {}),
      }));

      const indexesRes = await this.listIndexes(schema, table);
      const constraintsRes = await this.listConstraints(schema, table);
      const fksRes = await this.listForeignKeys(schema, table);

      if (indexesRes.isErr()) return err(indexesRes.error);
      if (constraintsRes.isErr()) return err(constraintsRes.error);
      if (fksRes.isErr()) return err(fksRes.error);

      const definition: TableDefinition = {
        schema,
        name: table,
        columns,
        indexes: indexesRes.value.map((i) => ({
          name: i.name,
          columns: i.columns,
          isUnique: i.isUnique,
          isPartial: false,
        })),
        foreignKeys: fksRes.value.map((fk) => ({
          name: fk.name,
          columns: fk.columns,
          referencedTable: fk.referencedTable,
          referencedColumns: fk.referencedColumns,
          ...(fk.referencedSchema ? { referencedSchema: fk.referencedSchema } : {}),
        })),
        constraints: constraintsRes.value.map((c) => ({
          name: c.name,
          type: c.type,
          ...(c.expression != null ? { expression: c.expression } : {}),
        })),
      };

      return ok(definition);
    } catch (e) {
      return err(new PersistenceError('UNKNOWN', `Failed to describe table: ${String(e)}`, e));
    }
  }

  async listIndexes(schema: string, table: string): Promise<Result<IndexInfo[], PersistenceError>> {
    try {
      const req = this.pool.request();
      req.input('table', table);
      req.input('schema', schema);
      const res = await req.query(`
        SELECT i.name AS idx_name, i.is_unique, i.is_primary_key,
               STRING_AGG(c.name, ',') WITHIN GROUP (ORDER BY ic.key_ordinal) AS col_list
        FROM sys.indexes i
        JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
        JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
        JOIN sys.tables t ON i.object_id = t.object_id
        JOIN sys.schemas s ON t.schema_id = s.schema_id
        WHERE t.name = @table AND s.name = @schema AND i.type > 0
        GROUP BY i.name, i.is_unique, i.is_primary_key
        ORDER BY i.name
      `);

      const indexes: IndexInfo[] = (
        res.recordset as {
          idx_name: string;
          is_unique: boolean;
          is_primary_key: boolean;
          col_list: string;
        }[]
      ).map((r) => ({
        name: r.idx_name,
        schema,
        table,
        columns: r.col_list.split(','),
        isUnique: r.is_unique,
        isPrimary: r.is_primary_key,
      }));
      return ok(indexes);
    } catch (e) {
      return err(new PersistenceError('UNKNOWN', `Failed to list indexes: ${String(e)}`, e));
    }
  }

  async listForeignKeys(
    schema: string,
    table: string,
  ): Promise<Result<ForeignKeyInfo[], PersistenceError>> {
    try {
      const req = this.pool.request();
      req.input('table', table);
      req.input('schema', schema);
      const res = await req.query(`
        SELECT fk.name AS fk_name,
               SCHEMA_NAME(tp.schema_id) AS ref_schema,
               tp.name AS ref_table,
               STRING_AGG(cp.name, ',') WITHIN GROUP (ORDER BY fkc.constraint_column_id) AS cols,
               STRING_AGG(cr.name, ',') WITHIN GROUP (ORDER BY fkc.constraint_column_id) AS ref_cols
        FROM sys.foreign_keys fk
        JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
        JOIN sys.tables tf ON fk.parent_object_id = tf.object_id
        JOIN sys.schemas sf ON tf.schema_id = sf.schema_id
        JOIN sys.columns cp ON fkc.parent_object_id = cp.object_id AND fkc.parent_column_id = cp.column_id
        JOIN sys.tables tp ON fk.referenced_object_id = tp.object_id
        JOIN sys.columns cr ON fkc.referenced_object_id = cr.object_id AND fkc.referenced_column_id = cr.column_id
        WHERE tf.name = @table AND sf.name = @schema
        GROUP BY fk.name, tp.schema_id, tp.name
        ORDER BY fk.name
      `);

      const fks: ForeignKeyInfo[] = (
        res.recordset as {
          fk_name: string;
          ref_schema: string;
          ref_table: string;
          cols: string;
          ref_cols: string;
        }[]
      ).map((r) => ({
        name: r.fk_name,
        schema,
        table,
        columns: r.cols.split(','),
        referencedSchema: r.ref_schema,
        referencedTable: r.ref_table,
        referencedColumns: r.ref_cols.split(','),
      }));
      return ok(fks);
    } catch (e) {
      return err(new PersistenceError('UNKNOWN', `Failed to list foreign keys: ${String(e)}`, e));
    }
  }

  async listConstraints(
    schema: string,
    table: string,
  ): Promise<Result<ConstraintInfo[], PersistenceError>> {
    try {
      const req = this.pool.request();
      req.input('table', table);
      req.input('schema', schema);
      const res = await req.query(`
        SELECT tc.CONSTRAINT_NAME AS name,
               tc.CONSTRAINT_TYPE AS type,
               cc.CHECK_CLAUSE AS expression
        FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
        LEFT JOIN INFORMATION_SCHEMA.CHECK_CONSTRAINTS cc
          ON tc.CONSTRAINT_NAME = cc.CONSTRAINT_NAME
        WHERE tc.TABLE_NAME = @table AND tc.TABLE_SCHEMA = @schema
        ORDER BY tc.CONSTRAINT_NAME
      `);

      const constraints: ConstraintInfo[] = (
        res.recordset as { name: string; type: string; expression: string | null }[]
      ).map((r) => ({
        name: r.name,
        schema,
        table,
        type: mapConstraintType(r.type),
        ...(r.expression != null ? { expression: r.expression } : {}),
      }));
      return ok(constraints);
    } catch (e) {
      return err(new PersistenceError('UNKNOWN', `Failed to list constraints: ${String(e)}`, e));
    }
  }
}

function mapConstraintType(t: string): ConstraintInfo['type'] {
  switch (t) {
    case 'CHECK':
      return 'CHECK';
    case 'UNIQUE':
      return 'UNIQUE';
    case 'PRIMARY KEY':
      return 'PRIMARY_KEY';
    case 'FOREIGN KEY':
      return 'FOREIGN_KEY';
    default:
      return 'CHECK';
  }
}
