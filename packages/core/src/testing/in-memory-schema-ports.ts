import type {
  MigrationRecord,
  SchemaDdlPort,
  SchemaIntrospectionPort,
  SchemaMigrationPort,
  TableDefinition,
} from '@platform/ports-persistence';

import { ok } from 'neverthrow';

// ── In-memory SchemaDdlPort ────────────────────────────────────────────────────

export function createInMemoryDdl(): SchemaDdlPort {
  return {
    createTable(definition: TableDefinition) {
      const cols = definition.columns
        .map((c) => `  "${c.name}" ${c.type.kind.toUpperCase()}${c.nullable ? '' : ' NOT NULL'}`)
        .join(',\n');
      return ok([{ sql: `CREATE TABLE "${definition.name}" (\n${cols}\n)` }]);
    },

    alterTable(from: TableDefinition, to: TableDefinition) {
      return ok([{ sql: `-- ALTER TABLE "${from.name}" TO "${to.name}"` }]);
    },

    dropTable(schema: string, table: string, opts?: { ifExists?: boolean }) {
      const ifEx = opts?.ifExists ? ' IF EXISTS' : '';
      return ok([{ sql: `DROP TABLE${ifEx} "${schema}"."${table}"` }]);
    },

    createIndex(index, schema, table) {
      return ok([{ sql: `CREATE INDEX "${index.name}" ON "${schema}"."${table}"` }]);
    },

    dropIndex(indexName, schema) {
      const prefix = schema ? `"${schema}".` : '';
      return ok([{ sql: `DROP INDEX ${prefix}"${indexName}"` }]);
    },

    validate(_definition: TableDefinition) {
      return ok(undefined);
    },

    supports(_feature) {
      return true;
    },
  };
}

// ── In-memory SchemaMigrationPort ──────────────────────────────────────────────

export function createInMemoryMigration(): SchemaMigrationPort & {
  applied: MigrationRecord[];
} {
  const applied: MigrationRecord[] = [];

  return {
    applied,

    listApplied() {
      return Promise.resolve(ok([...applied]));
    },

    apply(migration: { id: string; name: string; up: string; down?: string }) {
      applied.push({
        id: migration.id,
        name: migration.name,
        appliedAt: new Date(),
        checksum: Buffer.from(migration.up).toString('base64').slice(0, 16),
      });
      return Promise.resolve(ok(undefined));
    },

    revert(migrationId: string) {
      const idx = applied.findIndex((m) => m.id === migrationId);
      if (idx !== -1) applied.splice(idx, 1);
      return Promise.resolve(ok(undefined));
    },

    isApplied(migrationId: string) {
      return Promise.resolve(ok(applied.some((m) => m.id === migrationId)));
    },
  };
}

// ── In-memory SchemaIntrospectionPort ──────────────────────────────────────────

export function createInMemoryIntrospection(): SchemaIntrospectionPort {
  return {
    listSchemas() {
      return Promise.resolve(ok([]));
    },
    listTables() {
      return Promise.resolve(ok([]));
    },
    describeTable(_schema: string, table: string) {
      return Promise.resolve(
        ok({ name: table, columns: [], indexes: [], foreignKeys: [], constraints: [] }),
      );
    },
    listIndexes() {
      return Promise.resolve(ok([]));
    },
    listForeignKeys() {
      return Promise.resolve(ok([]));
    },
    listConstraints() {
      return Promise.resolve(ok([]));
    },
    supports(_feature) {
      return false;
    },
  };
}
