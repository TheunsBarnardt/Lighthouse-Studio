import type { Db, Document } from 'mongodb';
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

// ── BSON → platform type inference ───────────────────────────────────────────

function bsonTypeToPlatform(bsonType: string | string[]): PlatformColumnType {
  const t = Array.isArray(bsonType) ? (bsonType[0] ?? 'string') : bsonType;
  switch (t) {
    case 'string':
      return { kind: 'string' };
    case 'int':
    case 'long':
      return { kind: 'integer' };
    case 'double':
    case 'decimal':
      return { kind: 'decimal', precision: 18, scale: 6 };
    case 'bool':
      return { kind: 'boolean' };
    case 'date':
      return { kind: 'timestamp_tz' };
    case 'binData':
      return { kind: 'binary' };
    case 'objectId':
      return { kind: 'string' };
    case 'array':
      return { kind: 'array', elementType: { kind: 'text' } };
    case 'object':
      return { kind: 'json' };
    default:
      return { kind: 'text' };
  }
}

export class MongoSchemaIntrospectionAdapter implements SchemaIntrospectionPort {
  constructor(private readonly db: Db) {}

  supports(feature: SchemaFeature): boolean {
    const supported: SchemaFeature[] = [
      'json_columns',
      'array_columns',
      'transactions',
      'change_streams',
    ];
    return supported.includes(feature);
  }

  async listSchemas(): Promise<Result<SchemaInfo[], PersistenceError>> {
    // MongoDB has no schemas; the database itself is the schema equivalent
    try {
      const admin = this.db.admin();
      const result = await admin.listDatabases();
      const schemas = result.databases.map((d) => ({ name: d.name }));
      return ok(schemas);
    } catch (e) {
      return err(new PersistenceError('UNKNOWN', `Failed to list databases: ${String(e)}`, e));
    }
  }

  async listTables(schema?: string): Promise<Result<TableInfo[], PersistenceError>> {
    try {
      const targetDb = schema ? this.db.client.db(schema) : this.db;
      const collections = await targetDb.listCollections().toArray();
      const tables: TableInfo[] = collections.map((c) => ({
        name: c.name,
        type: 'table' as const,
      }));
      return ok(tables);
    } catch (e) {
      return err(new PersistenceError('UNKNOWN', `Failed to list collections: ${String(e)}`, e));
    }
  }

  async describeTable(
    schema: string,
    table: string,
  ): Promise<Result<TableDefinition, PersistenceError>> {
    try {
      const colInfo = await this.db.listCollections({ name: table }).toArray();

      const validator = (colInfo[0] as { options?: { validator?: Document } } | undefined)?.options
        ?.validator;

      let columns: ColumnDefinition[];

      if (validator) {
        const jsonSchema = (validator as { $jsonSchema?: Document })['$jsonSchema'];
        if (jsonSchema) {
          const properties =
            (jsonSchema as { properties?: Record<string, Document> }).properties ?? {};
          const required = (jsonSchema as { required?: string[] }).required ?? [];

          columns = Object.entries(properties)
            .filter(([name]) => name !== '_id')
            .map(([name, def]) => ({
              name,
              type: bsonTypeToPlatform(
                (def as { bsonType?: string | string[] }).bsonType ?? 'string',
              ),
              nullable: !required.includes(name),
              isPrimaryKey: name === 'id',
              isUnique: name === 'id',
            }));
        } else {
          const inferred = await this.inferColumnsFromSample(table);
          if (inferred.isErr()) return err(inferred.error);
          columns = inferred.value;
        }
      } else {
        const inferred = await this.inferColumnsFromSample(table);
        if (inferred.isErr()) return err(inferred.error);
        columns = inferred.value;
      }

      const indexesRes = await this.listIndexes(schema, table);
      if (indexesRes.isErr()) return err(indexesRes.error);

      const definition: TableDefinition = {
        name: table,
        columns,
        indexes: indexesRes.value.map((i) => ({
          name: i.name,
          columns: i.columns,
          isUnique: i.isUnique,
          isPartial: false,
        })),
        foreignKeys: [],
        constraints: [],
      };

      return ok(definition);
    } catch (e) {
      return err(new PersistenceError('UNKNOWN', `Failed to describe collection: ${String(e)}`, e));
    }
  }

  async listIndexes(
    _schema: string,
    table: string,
  ): Promise<Result<IndexInfo[], PersistenceError>> {
    try {
      const indexes = await this.db.collection(table).indexes();
      const result: IndexInfo[] = indexes.map((idx) => ({
        name: idx.name ?? 'unknown',
        table,
        columns: Object.keys(idx.key as Record<string, unknown>),
        isUnique: idx.unique ?? false,
        isPrimary: idx.name === '_id_',
      }));
      return ok(result);
    } catch (e) {
      return err(new PersistenceError('UNKNOWN', `Failed to list indexes: ${String(e)}`, e));
    }
  }

  listForeignKeys(
    _schema: string,
    _table: string,
  ): Promise<Result<ForeignKeyInfo[], PersistenceError>> {
    return Promise.resolve(ok([]));
  }

  listConstraints(
    _schema: string,
    _table: string,
  ): Promise<Result<ConstraintInfo[], PersistenceError>> {
    return Promise.resolve(ok([]));
  }

  private async inferColumnsFromSample(
    collection: string,
  ): Promise<Result<ColumnDefinition[], PersistenceError>> {
    try {
      const sample = await this.db.collection(collection).find({}).limit(10).toArray();
      if (sample.length === 0) return ok([]);

      const fieldMap = new Map<string, Set<string>>();
      for (const doc of sample) {
        for (const [key, value] of Object.entries(doc)) {
          if (key === '_id') continue;
          if (!fieldMap.has(key)) fieldMap.set(key, new Set());
          fieldMap.get(key)?.add(typeof value === 'object' ? 'object' : typeof value);
        }
      }

      const cols: ColumnDefinition[] = [...fieldMap.entries()].map(([name]) => ({
        name,
        type: { kind: 'text' } as PlatformColumnType,
        nullable: true,
        isPrimaryKey: name === 'id',
        isUnique: name === 'id',
      }));

      return ok(cols);
    } catch (e) {
      return err(new PersistenceError('UNKNOWN', `Schema inference failed: ${String(e)}`, e));
    }
  }
}
