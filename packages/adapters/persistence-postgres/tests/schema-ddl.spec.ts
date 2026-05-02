import type { TableDefinition } from '@platform/ports-persistence';

import { describe, expect, it } from 'vitest';

import { PostgresSchemaDdlAdapter } from '../src/schema-ddl.adapter.js';

const adapter = new PostgresSchemaDdlAdapter();

const baseTable: TableDefinition = {
  schema: 'public',
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

describe('PostgresSchemaDdlAdapter', () => {
  // ── createTable ──────────────────────────────────────────────────────────

  it('creates a valid CREATE TABLE statement', () => {
    const result = adapter.createTable(baseTable);
    expect(result.isOk()).toBe(true);
    const stmts = result._unsafeUnwrap();
    expect(stmts.length).toBeGreaterThanOrEqual(1);
    const ddl = stmts[0]?.sql ?? '';
    expect(ddl).toContain('CREATE TABLE "public"."projects"');
    expect(ddl).toContain('"id" UUID');
    expect(ddl).toContain('"name" VARCHAR(255)');
    expect(ddl).toContain('"description" TEXT');
    expect(ddl).toContain('PRIMARY KEY ("id")');
  });

  it('includes an index statement', () => {
    const result = adapter.createTable(baseTable);
    const stmts = result._unsafeUnwrap();
    const hasIndex = stmts.some((s) => s.sql.includes('CREATE') && s.sql.includes('INDEX'));
    expect(hasIndex).toBe(true);
  });

  it('includes reverseSql for CREATE TABLE', () => {
    const stmts = adapter.createTable(baseTable)._unsafeUnwrap();
    const first = stmts[0];
    expect(first?.reverseSql).toBeDefined();
    expect(first?.reverseSql).toContain('DROP TABLE');
  });

  it('includes FOREIGN KEY when defined', () => {
    const withFk: TableDefinition = {
      ...baseTable,
      foreignKeys: [
        {
          name: 'projects_workspace_fk',
          columns: ['workspace_id'],
          referencedTable: 'workspaces',
          referencedColumns: ['id'],
          onDelete: 'CASCADE',
        },
      ],
    };
    const stmts = adapter.createTable(withFk)._unsafeUnwrap();
    const ddl = stmts[0]?.sql ?? '';
    expect(ddl).toContain('CONSTRAINT "projects_workspace_fk" FOREIGN KEY');
    expect(ddl).toContain('ON DELETE CASCADE');
  });

  it('includes CHECK constraint when defined', () => {
    const withCheck: TableDefinition = {
      ...baseTable,
      constraints: [{ name: 'name_not_empty', type: 'CHECK', expression: 'length(name) > 0' }],
    };
    const stmts = adapter.createTable(withCheck)._unsafeUnwrap();
    const ddl = stmts[0]?.sql ?? '';
    expect(ddl).toContain('CONSTRAINT "name_not_empty" CHECK');
  });

  // ── type mapping ──────────────────────────────────────────────────────────

  it.each([
    [{ kind: 'string' as const, length: 100 }, 'VARCHAR(100)'],
    [{ kind: 'text' as const }, 'TEXT'],
    [{ kind: 'integer' as const }, 'INTEGER'],
    [{ kind: 'bigint' as const }, 'BIGINT'],
    [{ kind: 'decimal' as const, precision: 10, scale: 2 }, 'NUMERIC(10, 2)'],
    [{ kind: 'boolean' as const }, 'BOOLEAN'],
    [{ kind: 'date' as const }, 'DATE'],
    [{ kind: 'timestamp' as const }, 'TIMESTAMP WITHOUT TIME ZONE'],
    [{ kind: 'timestamp_tz' as const }, 'TIMESTAMP WITH TIME ZONE'],
    [{ kind: 'uuid' as const }, 'UUID'],
    [{ kind: 'binary' as const }, 'BYTEA'],
    [{ kind: 'json' as const }, 'JSONB'],
  ])('maps %o to %s', (type, pgType) => {
    const table: TableDefinition = {
      schema: 'public',
      name: 'test_types',
      columns: [
        {
          name: 'id',
          type: { kind: 'uuid' },
          nullable: false,
          isPrimaryKey: true,
          isUnique: false,
        },
        { name: 'col', type, nullable: true, isPrimaryKey: false, isUnique: false },
      ],
      indexes: [],
      foreignKeys: [],
      constraints: [],
    };
    const stmts = adapter.createTable(table)._unsafeUnwrap();
    expect(stmts[0]?.sql ?? '').toContain(pgType);
  });

  // ── validate ──────────────────────────────────────────────────────────────

  it('rejects a table with no primary key', () => {
    const noPk: TableDefinition = {
      ...baseTable,
      columns: baseTable.columns.map((c) => ({ ...c, isPrimaryKey: false })),
    };
    const result = adapter.validate(noPk);
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().message).toContain('primary key');
  });

  it('rejects a table with no columns', () => {
    const noColsTable: TableDefinition = { ...baseTable, columns: [] };
    const result = adapter.validate(noColsTable);
    expect(result.isErr()).toBe(true);
  });

  it('rejects a table name exceeding 63 chars', () => {
    const longName: TableDefinition = { ...baseTable, name: 'a'.repeat(64) };
    const result = adapter.validate(longName);
    expect(result.isErr()).toBe(true);
  });

  it('rejects a reserved keyword column name', () => {
    const reservedCol: TableDefinition = {
      ...baseTable,
      columns: [
        ...baseTable.columns,
        {
          name: 'select',
          type: { kind: 'text' },
          nullable: true,
          isPrimaryKey: false,
          isUnique: false,
        },
      ],
    };
    const result = adapter.validate(reservedCol);
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().message).toContain('reserved keyword');
  });

  // ── dropTable ─────────────────────────────────────────────────────────────

  it('generates DROP TABLE IF EXISTS', () => {
    const stmts = adapter.dropTable('public', 'projects', { ifExists: true })._unsafeUnwrap();
    expect(stmts[0]?.sql).toBe('DROP TABLE IF EXISTS "public"."projects";');
  });

  // ── createIndex ───────────────────────────────────────────────────────────

  it('generates a unique index', () => {
    const idx = { name: 'my_unique_idx', columns: ['name'], isUnique: true, isPartial: false };
    const stmts = adapter.createIndex(idx, 'public', 'projects')._unsafeUnwrap();
    expect(stmts[0]?.sql ?? '').toContain('CREATE UNIQUE INDEX CONCURRENTLY');
  });

  it('generates a partial index when predicate is provided', () => {
    const idx = {
      name: 'active_only_idx',
      columns: ['name'],
      isUnique: false,
      isPartial: true,
      predicate: 'active = true',
    };
    const stmts = adapter.createIndex(idx, 'public', 'projects')._unsafeUnwrap();
    expect(stmts[0]?.sql ?? '').toContain('WHERE active = true');
  });

  it('rejects an index with no columns', () => {
    const idx = { name: 'empty_idx', columns: [], isUnique: false, isPartial: false };
    const result = adapter.createIndex(idx, 'public', 'projects');
    expect(result.isErr()).toBe(true);
  });

  // ── alterTable ────────────────────────────────────────────────────────────

  it('adds new columns in alterTable', () => {
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
    expect(stmts.some((s) => s.sql.includes('ADD COLUMN') && s.sql.includes('"notes"'))).toBe(true);
  });

  it('drops removed columns in alterTable', () => {
    const to: TableDefinition = {
      ...baseTable,
      columns: baseTable.columns.filter((c) => c.name !== 'description'),
    };
    const stmts = adapter.alterTable(baseTable, to)._unsafeUnwrap();
    expect(
      stmts.some((s) => s.sql.includes('DROP COLUMN') && s.sql.includes('"description"')),
    ).toBe(true);
  });

  // ── supports ─────────────────────────────────────────────────────────────

  it('reports supported features', () => {
    expect(adapter.supports('schemas')).toBe(true);
    expect(adapter.supports('foreign_keys')).toBe(true);
    expect(adapter.supports('json_columns')).toBe(true);
    expect(adapter.supports('partial_indexes')).toBe(true);
  });
});
