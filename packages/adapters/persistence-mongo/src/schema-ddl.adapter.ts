import type { CreateCollectionOptions, Db, Document } from 'mongodb';
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

// ── Type mapping: normalized → BSON types ────────────────────────────────────

function platformTypeToBsonType(t: PlatformColumnType): string | string[] {
  switch (t.kind) {
    case 'string':
    case 'text':
      return 'string';
    case 'integer':
      return 'int';
    case 'bigint':
      return 'long';
    case 'decimal':
      return 'decimal';
    case 'boolean':
      return 'bool';
    case 'date':
    case 'timestamp':
    case 'timestamp_tz':
      return 'date';
    case 'uuid':
      return 'string';
    case 'binary':
      return 'binData';
    case 'json':
      return 'object';
    case 'array':
      return 'array';
  }
}

function buildJsonSchema(def: TableDefinition): Document {
  const properties: Record<string, Document> = {
    _id: { bsonType: 'string' },
    _version: { bsonType: 'int' },
    _archived_at: { bsonType: ['date', 'null'] },
    _created_at: { bsonType: 'date' },
    _updated_at: { bsonType: 'date' },
  };

  const required: string[] = ['_id', '_version', '_created_at', '_updated_at'];

  for (const col of def.columns) {
    const bsonType = platformTypeToBsonType(col.type);
    const bsonTypes: string[] = Array.isArray(bsonType) ? bsonType : [bsonType];

    if (col.nullable) {
      properties[col.name] = { bsonType: [...bsonTypes, 'null'] };
    } else {
      const singleType = bsonTypes.at(0);
      properties[col.name] = {
        bsonType: bsonTypes.length === 1 && singleType !== undefined ? singleType : bsonTypes,
      };
      required.push(col.name);
    }
  }

  return {
    $jsonSchema: {
      bsonType: 'object',
      required,
      properties,
      additionalProperties: true,
    },
  };
}

// ── Adapter ───────────────────────────────────────────────────────────────────

export class MongoDdlAdapter implements SchemaDdlPort {
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

  validate(definition: TableDefinition): Result<void, DdlError> {
    if (!definition.name) {
      return err(new DdlError('Collection name is required'));
    }
    if (definition.columns.length === 0) {
      return err(new DdlError(`Collection "${definition.name}" must have at least one field`));
    }
    return ok(undefined);
  }

  createTable(definition: TableDefinition): Result<DdlStatement[], DdlError> {
    const validateResult = this.validate(definition);
    if (validateResult.isErr()) return err(validateResult.error);

    const validator = buildJsonSchema(definition);
    const sql = JSON.stringify(
      { createCollection: definition.name, validator, indexes: definition.indexes },
      null,
      2,
    );
    const reverseSql = JSON.stringify({ dropCollection: definition.name }, null, 2);
    const statements: DdlStatement[] = [{ sql, reverseSql }];

    for (const idx of definition.indexes) {
      const idxResult = this.createIndex(idx, definition.schema ?? '', definition.name);
      if (idxResult.isErr()) return err(idxResult.error);
      statements.push(...idxResult.value);
    }

    return ok(statements);
  }

  alterTable(from: TableDefinition, to: TableDefinition): Result<DdlStatement[], DdlError> {
    const validateResult = this.validate(to);
    if (validateResult.isErr()) return err(validateResult.error);

    const statements: DdlStatement[] = [];

    const fromCols = new Map(from.columns.map((c) => [c.name, c]));
    const toCols = new Map(to.columns.map((c) => [c.name, c]));

    for (const [name, col] of toCols) {
      if (!fromCols.has(name)) {
        const sql = JSON.stringify(
          {
            collMod: to.name,
            addField: {
              name: col.name,
              bsonType: platformTypeToBsonType(col.type),
              nullable: col.nullable,
            },
          },
          null,
          2,
        );
        statements.push({ sql });
      }
    }

    for (const [name] of fromCols) {
      if (!toCols.has(name)) {
        const sql = JSON.stringify({ collMod: to.name, dropField: name }, null, 2);
        statements.push({ sql });
      }
    }

    const fromIndexNames = new Set(from.indexes.map((i) => i.name));
    for (const idx of to.indexes) {
      if (!fromIndexNames.has(idx.name)) {
        const idxResult = this.createIndex(idx, to.schema ?? '', to.name);
        if (idxResult.isErr()) return err(idxResult.error);
        statements.push(...idxResult.value);
      }
    }

    const toIndexNames = new Set(to.indexes.map((i) => i.name));
    for (const idx of from.indexes) {
      if (!toIndexNames.has(idx.name)) {
        const dropResult = this.dropIndex(idx.name);
        if (dropResult.isErr()) return err(dropResult.error);
        statements.push(...dropResult.value);
      }
    }

    return ok(statements);
  }

  dropTable(
    _schema: string,
    table: string,
    _opts?: { ifExists?: boolean },
  ): Result<DdlStatement[], DdlError> {
    return ok([{ sql: JSON.stringify({ dropCollection: table }, null, 2) }]);
  }

  createIndex(
    index: IndexDefinition,
    _schema: string,
    table: string,
  ): Result<DdlStatement[], DdlError> {
    if (index.columns.length === 0) {
      return err(new DdlError(`Index "${index.name}" must have at least one column`));
    }
    const keys: Record<string, number> = {};
    for (const col of index.columns) {
      keys[col] = 1;
    }
    const sql = JSON.stringify(
      { createIndex: table, keys, options: { name: index.name, unique: index.isUnique } },
      null,
      2,
    );
    const reverseSql = JSON.stringify(
      { dropIndex: { collection: table, name: index.name } },
      null,
      2,
    );
    return ok([{ sql, reverseSql }]);
  }

  dropIndex(indexName: string, _schema?: string): Result<DdlStatement[], DdlError> {
    // MongoDB requires the collection name to drop an index, but the port doesn't provide it.
    // The dropIndex statement stores the index name; the collection must be resolved at execution time.
    return ok([{ sql: JSON.stringify({ dropIndexByName: indexName }, null, 2) }]);
  }

  async executeStatement(statement: DdlStatement): Promise<Result<void, DdlError>> {
    try {
      const parsed = JSON.parse(statement.sql) as Record<string, unknown>;

      if ('createCollection' in parsed) {
        const colName = String(parsed['createCollection']);
        const options: CreateCollectionOptions = {};
        if (parsed['validator']) options.validator = parsed['validator'] as Document;
        await this.db.createCollection(colName, options);

        if (Array.isArray(parsed['indexes'])) {
          const col = this.db.collection(colName);
          for (const idx of parsed['indexes'] as IndexDefinition[]) {
            const keys: Record<string, number> = {};
            for (const c of idx.columns) keys[c] = 1;
            await col.createIndex(keys, { name: idx.name, unique: idx.isUnique });
          }
        }
      } else if ('dropCollection' in parsed) {
        await this.db.dropCollection(String(parsed['dropCollection']));
      } else if ('createIndex' in parsed) {
        const colName = String(parsed['createIndex']);
        const keys = parsed['keys'] as Record<string, number>;
        const opts = (parsed['options'] ?? {}) as { name?: string; unique?: boolean };
        await this.db.collection(colName).createIndex(keys, opts);
      } else if ('dropIndex' in parsed) {
        const d = parsed['dropIndex'] as { collection: string; name: string };
        await this.db.collection(d.collection).dropIndex(d.name);
      } else if ('collMod' in parsed) {
        await this.db.command(parsed as Document);
      }

      return ok(undefined);
    } catch (e) {
      return err(new DdlError(`MongoDB DDL execution failed: ${String(e)}`, e));
    }
  }

  // ── Column helpers (used internally) ─────────────────────────────────────

  generateAddColumn(tableName: string, column: ColumnDefinition): Result<DdlStatement, DdlError> {
    const sql = JSON.stringify(
      {
        collMod: tableName,
        addField: {
          name: column.name,
          bsonType: platformTypeToBsonType(column.type),
          nullable: column.nullable,
        },
      },
      null,
      2,
    );
    return ok({ sql });
  }
}
