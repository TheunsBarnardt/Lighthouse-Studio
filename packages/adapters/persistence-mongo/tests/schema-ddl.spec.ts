import type { TableDefinition } from '@platform/ports-persistence';

import { describe, expect, it } from 'vitest';

import { MongoDdlAdapter } from '../src/schema-ddl.adapter.js';

// MongoDdlAdapter does not require a live Db for DDL generation — only executeStatement does.
// We cast null here intentionally; the unit tests never call executeStatement.
const adapter = new MongoDdlAdapter(null as never);

const baseTable: TableDefinition = {
  schema: '',
  name: 'projects',
  columns: [
    { name: 'id', type: { kind: 'uuid' }, nullable: false, isPrimaryKey: true, isUnique: false },
    {
      name: 'name',
      type: { kind: 'string', length: 255 },
      nullable: false,
      isPrimaryKey: false,
      isUnique: false,
    },
    {
      name: 'description',
      type: { kind: 'text' },
      nullable: true,
      isPrimaryKey: false,
      isUnique: false,
    },
    {
      name: 'workspace_id',
      type: { kind: 'uuid' },
      nullable: false,
      isPrimaryKey: false,
      isUnique: false,
    },
  ],
  indexes: [
    {
      name: 'projects_workspace_idx',
      columns: ['workspace_id'],
      isUnique: false,
      isPartial: false,
    },
  ],
  foreignKeys: [],
  constraints: [],
};

describe('MongoDdlAdapter', () => {
  // ── createTable ──────────────────────────────────────────────────────────

  it('generates a createCollection command with JSON schema validator', () => {
    const result = adapter.createTable(baseTable);
    expect(result.isOk()).toBe(true);
    const stmts = result._unsafeUnwrap();
    expect(stmts.length).toBeGreaterThanOrEqual(1);
    const cmd = JSON.parse(stmts[0]?.sql ?? '{}') as Record<string, unknown>;
    expect(cmd['createCollection']).toBe('projects');
    expect(cmd['validator']).toBeDefined();
  });

  it('includes $jsonSchema with bsonType properties for each column', () => {
    const stmts = adapter.createTable(baseTable)._unsafeUnwrap();
    const cmd = JSON.parse(stmts[0]?.sql ?? '{}') as {
      validator: { $jsonSchema: { properties: Record<string, unknown>; required: string[] } };
    };
    const schema = cmd.validator.$jsonSchema;
    expect(schema.properties['id']).toBeDefined();
    expect(schema.properties['name']).toBeDefined();
    expect(schema.properties['description']).toBeDefined();
    // Non-nullable columns must appear in required
    expect(schema.required).toContain('name');
    // Nullable columns must NOT appear in required
    expect(schema.required).not.toContain('description');
  });

  it('includes platform metadata columns in the schema (_id, _version, _created_at, _updated_at)', () => {
    const stmts = adapter.createTable(baseTable)._unsafeUnwrap();
    const cmd = JSON.parse(stmts[0]?.sql ?? '{}') as {
      validator: { $jsonSchema: { properties: Record<string, unknown> } };
    };
    const props = cmd.validator.$jsonSchema.properties;
    expect(props['_id']).toBeDefined();
    expect(props['_version']).toBeDefined();
    expect(props['_created_at']).toBeDefined();
    expect(props['_updated_at']).toBeDefined();
  });

  it('includes a reverseSql dropCollection command', () => {
    const stmts = adapter.createTable(baseTable)._unsafeUnwrap();
    const first = stmts[0];
    expect(first?.reverseSql).toBeDefined();
    const rev = JSON.parse(first?.reverseSql ?? '{}') as Record<string, unknown>;
    expect(rev['dropCollection']).toBe('projects');
  });

  it('generates a createIndex statement for each index', () => {
    const stmts = adapter.createTable(baseTable)._unsafeUnwrap();
    const indexStmt = stmts.find((s) => {
      const cmd = JSON.parse(s.sql) as Record<string, unknown>;
      return 'createIndex' in cmd;
    });
    expect(indexStmt).toBeDefined();
    const cmd = JSON.parse(indexStmt?.sql ?? '{}') as {
      createIndex: string;
      keys: Record<string, number>;
      options: { name: string };
    };
    expect(cmd.createIndex).toBe('projects');
    expect(cmd.keys['workspace_id']).toBe(1);
    expect(cmd.options.name).toBe('projects_workspace_idx');
  });

  // ── type mapping ──────────────────────────────────────────────────────────

  it.each([
    [{ kind: 'string' as const, length: 100 }, 'string'],
    [{ kind: 'text' as const }, 'string'],
    [{ kind: 'integer' as const }, 'int'],
    [{ kind: 'bigint' as const }, 'long'],
    [{ kind: 'boolean' as const }, 'bool'],
    [{ kind: 'date' as const }, 'date'],
    [{ kind: 'timestamp' as const }, 'date'],
    [{ kind: 'uuid' as const }, 'string'],
    [{ kind: 'json' as const }, 'object'],
    [{ kind: 'array' as const, elementType: { kind: 'string' as const } }, 'array'],
  ])('maps %o to bsonType %s', (type, expectedBsonType) => {
    const table: TableDefinition = {
      ...baseTable,
      columns: [
        ...baseTable.columns,
        { name: 'col', type, nullable: false, isPrimaryKey: false, isUnique: false },
      ],
      indexes: [],
    };
    const stmts = adapter.createTable(table)._unsafeUnwrap();
    const cmd = JSON.parse(stmts[0]?.sql ?? '{}') as {
      validator: { $jsonSchema: { properties: Record<string, { bsonType: unknown }> } };
    };
    expect(cmd.validator.$jsonSchema.properties['col']?.bsonType).toBe(expectedBsonType);
  });

  // ── validate ──────────────────────────────────────────────────────────────

  it('rejects a table with no columns', () => {
    const noColsTable: TableDefinition = { ...baseTable, columns: [] };
    const result = adapter.validate(noColsTable);
    expect(result.isErr()).toBe(true);
  });

  it('rejects a table with no name', () => {
    const noNameTable: TableDefinition = { ...baseTable, name: '' };
    const result = adapter.validate(noNameTable);
    expect(result.isErr()).toBe(true);
  });

  // ── dropTable ─────────────────────────────────────────────────────────────

  it('generates a dropCollection command', () => {
    const stmts = adapter.dropTable('', 'projects', { ifExists: true })._unsafeUnwrap();
    const cmd = JSON.parse(stmts[0]?.sql ?? '{}') as Record<string, unknown>;
    expect(cmd['dropCollection']).toBe('projects');
  });

  // ── createIndex ───────────────────────────────────────────────────────────

  it('generates a createIndex command with unique flag', () => {
    const idx = { name: 'my_unique_idx', columns: ['name'], isUnique: true, isPartial: false };
    const stmts = adapter.createIndex(idx, '', 'projects')._unsafeUnwrap();
    const cmd = JSON.parse(stmts[0]?.sql ?? '{}') as {
      createIndex: string;
      options: { unique: boolean };
    };
    expect(cmd.createIndex).toBe('projects');
    expect(cmd.options.unique).toBe(true);
  });

  it('generates a reverseSql dropIndex for createIndex', () => {
    const idx = { name: 'my_idx', columns: ['name'], isUnique: false, isPartial: false };
    const stmts = adapter.createIndex(idx, '', 'projects')._unsafeUnwrap();
    expect(stmts[0]?.reverseSql).toBeDefined();
    const rev = JSON.parse(stmts[0]?.reverseSql ?? '{}') as { dropIndex: { name: string } };
    expect(rev.dropIndex.name).toBe('my_idx');
  });

  it('rejects an index with no columns', () => {
    const idx = { name: 'empty_idx', columns: [], isUnique: false, isPartial: false };
    const result = adapter.createIndex(idx, '', 'projects');
    expect(result.isErr()).toBe(true);
  });

  // ── alterTable ────────────────────────────────────────────────────────────

  it('generates addField command for new columns', () => {
    const to: TableDefinition = {
      ...baseTable,
      columns: [
        ...baseTable.columns,
        {
          name: 'notes',
          type: { kind: 'text' },
          nullable: true,
          isPrimaryKey: false,
          isUnique: false,
        },
      ],
    };
    const stmts = adapter.alterTable(baseTable, to)._unsafeUnwrap();
    const addStmt = stmts.find((s) => {
      const cmd = JSON.parse(s.sql) as Record<string, unknown>;
      return 'addField' in cmd;
    });
    expect(addStmt).toBeDefined();
    const cmd = JSON.parse(addStmt?.sql ?? '{}') as { collMod: string; addField: { name: string } };
    expect(cmd.collMod).toBe('projects');
    expect(cmd.addField.name).toBe('notes');
  });

  it('generates dropField command for removed columns', () => {
    const to: TableDefinition = {
      ...baseTable,
      columns: baseTable.columns.filter((c) => c.name !== 'description'),
    };
    const stmts = adapter.alterTable(baseTable, to)._unsafeUnwrap();
    const dropStmt = stmts.find((s) => {
      const cmd = JSON.parse(s.sql) as Record<string, unknown>;
      return 'dropField' in cmd;
    });
    expect(dropStmt).toBeDefined();
    const cmd = JSON.parse(dropStmt?.sql ?? '{}') as { dropField: string };
    expect(cmd.dropField).toBe('description');
  });

  // ── supports ─────────────────────────────────────────────────────────────

  it('reports supported features', () => {
    expect(adapter.supports('json_columns')).toBe(true);
    expect(adapter.supports('array_columns')).toBe(true);
    expect(adapter.supports('change_streams')).toBe(true);
  });

  it('reports unsupported features', () => {
    expect(adapter.supports('foreign_keys')).toBe(false);
    expect(adapter.supports('partial_indexes')).toBe(false);
  });
});
