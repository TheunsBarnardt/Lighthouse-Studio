import type { Result } from 'neverthrow';
import type { Pool } from 'pg';

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

// ── Type mapping: Postgres → normalized ───────────────────────────────────────

function mapPgType(pgType: string, charMaxLength: number | null): PlatformColumnType {
  switch (pgType) {
    case 'character varying':
    case 'varchar':
      return charMaxLength !== null
        ? { kind: 'string', length: charMaxLength }
        : { kind: 'string' };
    case 'text':
    case 'name':
      return { kind: 'text' };
    case 'smallint':
    case 'int2':
      return { kind: 'integer' };
    case 'integer':
    case 'int':
    case 'int4':
      return { kind: 'integer' };
    case 'bigint':
    case 'int8':
      return { kind: 'bigint' };
    case 'numeric':
    case 'decimal':
      return { kind: 'decimal', precision: 18, scale: 4 }; // defaults; caller refines if needed
    case 'boolean':
    case 'bool':
      return { kind: 'boolean' };
    case 'date':
      return { kind: 'date' };
    case 'timestamp without time zone':
    case 'timestamp':
      return { kind: 'timestamp' };
    case 'timestamp with time zone':
    case 'timestamptz':
      return { kind: 'timestamp_tz' };
    case 'uuid':
      return { kind: 'uuid' };
    case 'bytea':
      return { kind: 'binary' };
    case 'json':
    case 'jsonb':
      return { kind: 'json' };
    default:
      // Unmapped type (tsvector, geometry, etc.) — surfaced as unknown
      return { kind: 'text' };
  }
}

// ── Adapter ───────────────────────────────────────────────────────────────────

export class PostgresSchemaIntrospectionAdapter implements SchemaIntrospectionPort {
  private extensionCache: Map<string, boolean> = new Map();

  constructor(private readonly pool: Pool) {}

  async listSchemas(): Promise<Result<SchemaInfo[], PersistenceError>> {
    try {
      const res = await this.pool.query<{ schema_name: string; schema_owner: string }>(
        `SELECT schema_name, schema_owner
         FROM information_schema.schemata
         WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
           AND schema_name NOT LIKE 'pg_temp_%'
           AND schema_name NOT LIKE 'pg_toast_temp_%'
         ORDER BY schema_name`,
      );
      return ok(res.rows.map((r) => ({ name: r.schema_name, owner: r.schema_owner })));
    } catch (e) {
      return err(new PersistenceError('UNKNOWN', `listSchemas failed: ${String(e)}`, e));
    }
  }

  async listTables(schema?: string): Promise<Result<TableInfo[], PersistenceError>> {
    const effectiveSchema = schema ?? 'public';
    try {
      const res = await this.pool.query<{
        table_name: string;
        table_type: string;
        table_schema: string;
      }>(
        `SELECT table_name, table_type, table_schema
         FROM information_schema.tables
         WHERE table_schema = $1
           AND table_name NOT LIKE 'pg_%'
         ORDER BY table_name`,
        [effectiveSchema],
      );
      return ok(
        res.rows.map((r) => ({
          schema: r.table_schema,
          name: r.table_name,
          type: r.table_type === 'VIEW' ? 'view' : 'table',
        })),
      );
    } catch (e) {
      return err(new PersistenceError('UNKNOWN', `listTables failed: ${String(e)}`, e));
    }
  }

  async describeTable(
    schema: string,
    table: string,
  ): Promise<Result<TableDefinition, PersistenceError>> {
    try {
      const colRes = await this.pool.query<{
        column_name: string;
        data_type: string;
        character_maximum_length: number | null;
        numeric_precision: number | null;
        numeric_scale: number | null;
        is_nullable: string;
        column_default: string | null;
        is_pk: boolean;
        is_unique: boolean;
      }>(
        `SELECT
           c.column_name,
           c.data_type,
           c.character_maximum_length,
           c.numeric_precision,
           c.numeric_scale,
           c.is_nullable,
           c.column_default,
           EXISTS (
             SELECT 1
             FROM information_schema.table_constraints tc
             JOIN information_schema.constraint_column_usage ccu
               ON tc.constraint_name = ccu.constraint_name
               AND tc.table_schema = ccu.table_schema
             WHERE tc.constraint_type = 'PRIMARY KEY'
               AND tc.table_schema = c.table_schema
               AND tc.table_name = c.table_name
               AND ccu.column_name = c.column_name
           ) AS is_pk,
           EXISTS (
             SELECT 1
             FROM information_schema.table_constraints tc
             JOIN information_schema.constraint_column_usage ccu
               ON tc.constraint_name = ccu.constraint_name
               AND tc.table_schema = ccu.table_schema
             WHERE tc.constraint_type = 'UNIQUE'
               AND tc.table_schema = c.table_schema
               AND tc.table_name = c.table_name
               AND ccu.column_name = c.column_name
           ) AS is_unique
         FROM information_schema.columns c
         WHERE c.table_schema = $1 AND c.table_name = $2
         ORDER BY c.ordinal_position`,
        [schema, table],
      );

      const columns: ColumnDefinition[] = colRes.rows.map((r) => {
        let type = mapPgType(r.data_type, r.character_maximum_length);
        if ((r.data_type === 'numeric' || r.data_type === 'decimal') && r.numeric_precision) {
          type = {
            kind: 'decimal',
            precision: r.numeric_precision,
            scale: r.numeric_scale ?? 0,
          };
        }
        return {
          name: r.column_name,
          type,
          nullable: r.is_nullable === 'YES',
          ...(r.column_default !== null ? { defaultValue: r.column_default } : {}),
          isPrimaryKey: Boolean(r.is_pk),
          isUnique: Boolean(r.is_unique),
        };
      });

      const [indexResult, fkResult, constraintResult] = await Promise.all([
        this.listIndexes(schema, table),
        this.listForeignKeys(schema, table),
        this.listConstraints(schema, table),
      ]);

      if (indexResult.isErr()) return err(indexResult.error);
      if (fkResult.isErr()) return err(fkResult.error);
      if (constraintResult.isErr()) return err(constraintResult.error);

      const indexes = indexResult.value.map((idx) => ({
        name: idx.name,
        columns: idx.columns,
        isUnique: idx.isUnique,
        isPartial: false,
        method: 'btree' as const,
      }));

      const foreignKeys = fkResult.value.map((fk) => ({
        name: fk.name,
        columns: fk.columns,
        ...(fk.referencedSchema !== undefined ? { referencedSchema: fk.referencedSchema } : {}),
        referencedTable: fk.referencedTable,
        referencedColumns: fk.referencedColumns,
      }));

      const constraints = constraintResult.value.map((c) => ({
        name: c.name,
        type: c.type,
        ...(c.expression !== undefined ? { expression: c.expression } : {}),
      }));

      return ok({ schema, name: table, columns, indexes, foreignKeys, constraints });
    } catch (e) {
      return err(new PersistenceError('UNKNOWN', `describeTable failed: ${String(e)}`, e));
    }
  }

  async listIndexes(schema: string, table: string): Promise<Result<IndexInfo[], PersistenceError>> {
    try {
      const res = await this.pool.query<{
        indexname: string;
        indexdef: string;
        indisunique: boolean;
        indisprimary: boolean;
        columns: string;
      }>(
        `SELECT
           i.relname AS indexname,
           pg_get_indexdef(ix.indexrelid) AS indexdef,
           ix.indisunique,
           ix.indisprimary,
           string_agg(a.attname, ',' ORDER BY array_position(ix.indkey, a.attnum)) AS columns
         FROM pg_index ix
         JOIN pg_class t ON t.oid = ix.indrelid
         JOIN pg_class i ON i.oid = ix.indexrelid
         JOIN pg_namespace n ON n.oid = t.relnamespace
         JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
         WHERE n.nspname = $1 AND t.relname = $2
         GROUP BY i.relname, ix.indexrelid, ix.indisunique, ix.indisprimary
         ORDER BY i.relname`,
        [schema, table],
      );

      return ok(
        res.rows.map((r) => ({
          name: r.indexname,
          schema,
          table,
          columns: r.columns.split(','),
          isUnique: r.indisunique,
          isPrimary: r.indisprimary,
        })),
      );
    } catch (e) {
      return err(new PersistenceError('UNKNOWN', `listIndexes failed: ${String(e)}`, e));
    }
  }

  async listForeignKeys(
    schema: string,
    table: string,
  ): Promise<Result<ForeignKeyInfo[], PersistenceError>> {
    try {
      const res = await this.pool.query<{
        constraint_name: string;
        column_name: string;
        foreign_schema: string;
        foreign_table: string;
        foreign_column: string;
      }>(
        `SELECT
           kcu.constraint_name,
           kcu.column_name,
           ccu.table_schema AS foreign_schema,
           ccu.table_name AS foreign_table,
           ccu.column_name AS foreign_column
         FROM information_schema.key_column_usage kcu
         JOIN information_schema.referential_constraints rc
           ON kcu.constraint_name = rc.constraint_name
           AND kcu.table_schema = rc.constraint_schema
         JOIN information_schema.constraint_column_usage ccu
           ON rc.unique_constraint_name = ccu.constraint_name
           AND rc.unique_constraint_schema = ccu.table_schema
         WHERE kcu.table_schema = $1 AND kcu.table_name = $2
         ORDER BY kcu.constraint_name, kcu.ordinal_position`,
        [schema, table],
      );

      const grouped = new Map<
        string,
        { columns: string[]; refSchema: string; refTable: string; refColumns: string[] }
      >();
      for (const row of res.rows) {
        if (!grouped.has(row.constraint_name)) {
          grouped.set(row.constraint_name, {
            columns: [],
            refSchema: row.foreign_schema,
            refTable: row.foreign_table,
            refColumns: [],
          });
        }
        const g = grouped.get(row.constraint_name);
        if (!g) continue;
        g.columns.push(row.column_name);
        g.refColumns.push(row.foreign_column);
      }

      return ok(
        Array.from(grouped.entries()).map(([name, g]) => ({
          name,
          schema,
          table,
          columns: g.columns,
          referencedSchema: g.refSchema,
          referencedTable: g.refTable,
          referencedColumns: g.refColumns,
        })),
      );
    } catch (e) {
      return err(new PersistenceError('UNKNOWN', `listForeignKeys failed: ${String(e)}`, e));
    }
  }

  async listConstraints(
    schema: string,
    table: string,
  ): Promise<Result<ConstraintInfo[], PersistenceError>> {
    try {
      const res = await this.pool.query<{
        constraint_name: string;
        constraint_type: string;
        check_clause: string | null;
      }>(
        `SELECT
           tc.constraint_name,
           tc.constraint_type,
           cc.check_clause
         FROM information_schema.table_constraints tc
         LEFT JOIN information_schema.check_constraints cc
           ON tc.constraint_name = cc.constraint_name
           AND tc.constraint_schema = cc.constraint_schema
         WHERE tc.table_schema = $1 AND tc.table_name = $2
         ORDER BY tc.constraint_name`,
        [schema, table],
      );

      return ok(
        res.rows.map((r) => ({
          name: r.constraint_name,
          schema,
          table,
          type:
            r.constraint_type === 'CHECK'
              ? ('CHECK' as const)
              : r.constraint_type === 'UNIQUE'
                ? ('UNIQUE' as const)
                : r.constraint_type === 'PRIMARY KEY'
                  ? ('PRIMARY_KEY' as const)
                  : ('FOREIGN_KEY' as const),
          ...(r.check_clause !== null ? { expression: r.check_clause } : {}),
        })),
      );
    } catch (e) {
      return err(new PersistenceError('UNKNOWN', `listConstraints failed: ${String(e)}`, e));
    }
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
        return this.extensionCache.get('postgis') ?? false;
      case 'transactions':
        return true;
      case 'change_streams':
        return true; // requires logical replication
      default:
        return false;
    }
  }

  /**
   * Cache which optional extensions are installed so that supports() is accurate.
   * Call once after connecting.
   */
  async warmCapabilityCache(): Promise<void> {
    try {
      const res = await this.pool.query<{ extname: string }>(
        `SELECT extname FROM pg_extension WHERE extname IN ('postgis', 'vector')`,
      );
      for (const row of res.rows) {
        this.extensionCache.set(row.extname, true);
      }
    } catch {
      // Non-fatal: capability cache stays empty
    }
  }
}
