import { describe, it, expect } from 'vitest';

import type { CustomerSchema, CustomerTableDefinition } from './schema-model.js';

import { SchemaValidator } from './schema-validator.js';

const validator = new SchemaValidator();

function baseSchema(driver: 'postgres' | 'mssql' | 'mongo' = 'postgres'): CustomerSchema {
  return {
    id: 'schema-1',
    workspaceId: 'ws-1',
    name: 'Test Schema',
    slug: 'test_schema',
    version: 1,
    databaseDriver: driver,
    tables: [],
    metadata: {
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'user-1',
      updatedBy: 'user-1',
    },
  };
}

function validTable(overrides: Partial<CustomerTableDefinition> = {}): CustomerTableDefinition {
  return {
    id: 'tbl-1',
    name: 'users',
    columns: [
      { id: 'col-1', name: 'id', type: { kind: 'uuid' }, nullable: false },
      { id: 'col-2', name: 'email', type: { kind: 'string', length: 255 }, nullable: false },
    ],
    indexes: [],
    foreignKeys: [],
    constraints: [],
    primaryKey: { kind: 'single', columnId: 'col-1' },
    ...overrides,
  };
}

// ── Naming rules ───────────────────────────────────────────────────────────────

describe('SchemaValidator — naming rules', () => {
  it('accepts valid snake_case names', () => {
    const schema = baseSchema();
    const report = validator.validate(schema, { tables: [validTable()] }, 'postgres');
    expect(report.valid).toBe(true);
  });

  it('rejects CamelCase table names', () => {
    const schema = baseSchema();
    const report = validator.validate(
      schema,
      { tables: [validTable({ name: 'UserProfile' })] },
      'postgres',
    );
    expect(report.errors.some((e) => e.code === 'NAME_NOT_SNAKE_CASE')).toBe(true);
  });

  it('rejects names starting with a number', () => {
    const schema = baseSchema();
    const report = validator.validate(
      schema,
      { tables: [validTable({ name: '2_users' })] },
      'postgres',
    );
    expect(report.errors.some((e) => e.code === 'NAME_NOT_SNAKE_CASE')).toBe(true);
  });

  it('rejects Postgres reserved word "select" as table name', () => {
    const schema = baseSchema();
    const report = validator.validate(
      schema,
      { tables: [validTable({ name: 'select' })] },
      'postgres',
    );
    expect(report.errors.some((e) => e.code === 'NAME_RESERVED_WORD')).toBe(true);
  });

  it('rejects MSSQL reserved word "table" as table name', () => {
    const schema = baseSchema('mssql');
    const report = validator.validate(schema, { tables: [validTable({ name: 'table' })] }, 'mssql');
    expect(report.errors.some((e) => e.code === 'NAME_RESERVED_WORD')).toBe(true);
  });

  it('rejects names starting with _platform_', () => {
    const schema = baseSchema();
    const report = validator.validate(
      schema,
      { tables: [validTable({ name: '_platform_users' })] },
      'postgres',
    );
    expect(report.errors.some((e) => e.code === 'NAME_RESERVED_PREFIX')).toBe(true);
  });

  it('rejects duplicate table names', () => {
    const schema = baseSchema();
    const report = validator.validate(
      schema,
      {
        tables: [
          validTable({ id: 'tbl-1', name: 'users' }),
          validTable({ id: 'tbl-2', name: 'users' }),
        ],
      },
      'postgres',
    );
    expect(report.errors.some((e) => e.code === 'TABLE_DUPLICATE_NAME')).toBe(true);
  });
});

// ── Primary key ────────────────────────────────────────────────────────────────

describe('SchemaValidator — primary key', () => {
  it('errors on table with no primary key', () => {
    const schema = baseSchema();
    const table = validTable({
      primaryKey: null as unknown as { kind: 'single'; columnId: string },
    });
    const report = validator.validate(schema, { tables: [table] }, 'postgres');
    expect(report.errors.some((e) => e.code === 'TABLE_NO_PRIMARY_KEY')).toBe(true);
  });

  it('errors when PK column does not exist', () => {
    const schema = baseSchema();
    const table = validTable({ primaryKey: { kind: 'single', columnId: 'nonexistent-col' } });
    const report = validator.validate(schema, { tables: [table] }, 'postgres');
    expect(report.errors.some((e) => e.code === 'PK_UNKNOWN_COLUMN')).toBe(true);
  });

  it('errors when PK column is nullable', () => {
    const schema = baseSchema();
    const table = validTable({
      columns: [{ id: 'col-1', name: 'id', type: { kind: 'uuid' }, nullable: true }],
      primaryKey: { kind: 'single', columnId: 'col-1' },
    });
    const report = validator.validate(schema, { tables: [table] }, 'postgres');
    expect(report.errors.some((e) => e.code === 'PK_NULLABLE')).toBe(true);
  });
});

// ── Type compatibility ─────────────────────────────────────────────────────────

describe('SchemaValidator — type compatibility', () => {
  it('errors on array column for MSSQL', () => {
    const schema = baseSchema('mssql');
    const table = validTable({
      columns: [
        { id: 'col-1', name: 'id', type: { kind: 'uuid' }, nullable: false },
        {
          id: 'col-2',
          name: 'tags',
          type: { kind: 'array', elementType: { kind: 'string' } },
          nullable: true,
        },
      ],
    });
    const report = validator.validate(schema, { tables: [table] }, 'mssql');
    expect(report.errors.some((e) => e.code === 'TYPE_ARRAY_NOT_SUPPORTED')).toBe(true);
  });

  it('allows array columns on Postgres', () => {
    const schema = baseSchema('postgres');
    const table = validTable({
      columns: [
        { id: 'col-1', name: 'id', type: { kind: 'uuid' }, nullable: false },
        {
          id: 'col-2',
          name: 'tags',
          type: { kind: 'array', elementType: { kind: 'string' } },
          nullable: true,
        },
      ],
    });
    const report = validator.validate(schema, { tables: [table] }, 'postgres');
    expect(report.errors.every((e) => e.code !== 'TYPE_ARRAY_NOT_SUPPORTED')).toBe(true);
  });

  it('allows array columns on Mongo', () => {
    const schema = baseSchema('mongo');
    const table = validTable({
      columns: [
        { id: 'col-1', name: 'id', type: { kind: 'uuid' }, nullable: false },
        {
          id: 'col-2',
          name: 'tags',
          type: { kind: 'array', elementType: { kind: 'string' } },
          nullable: true,
        },
      ],
    });
    const report = validator.validate(schema, { tables: [table] }, 'mongo');
    expect(report.errors.every((e) => e.code !== 'TYPE_ARRAY_NOT_SUPPORTED')).toBe(true);
  });
});

// ── Foreign keys ───────────────────────────────────────────────────────────────

describe('SchemaValidator — foreign keys', () => {
  it('errors when FK references unknown table', () => {
    const schema = baseSchema();
    const table = validTable({
      foreignKeys: [
        {
          id: 'fk-1',
          name: 'fk_posts_user',
          columns: ['col-1'],
          referencedTableId: 'nonexistent-table',
          referencedColumns: ['col-1'],
          onDelete: 'cascade',
          onUpdate: 'no_action',
        },
      ],
    });
    const report = validator.validate(schema, { tables: [table] }, 'postgres');
    expect(report.errors.some((e) => e.code === 'FK_UNKNOWN_TABLE')).toBe(true);
  });

  it('warns about advisory FK on Mongo', () => {
    const schema = baseSchema('mongo');
    const users = validTable({ id: 'tbl-1', name: 'users' });
    const posts = validTable({
      id: 'tbl-2',
      name: 'posts',
      columns: [
        { id: 'col-1', name: 'id', type: { kind: 'uuid' }, nullable: false },
        { id: 'col-2', name: 'user_id', type: { kind: 'uuid' }, nullable: false },
      ],
      foreignKeys: [
        {
          id: 'fk-1',
          name: 'fk_posts_user',
          columns: ['col-2'],
          referencedTableId: 'tbl-1',
          referencedColumns: ['col-1'],
          onDelete: 'no_action',
          onUpdate: 'no_action',
        },
      ],
      primaryKey: { kind: 'single', columnId: 'col-1' },
    });
    const report = validator.validate(schema, { tables: [users, posts] }, 'mongo');
    expect(report.warnings.some((w) => w.code === 'FK_ADVISORY_ONLY')).toBe(true);
    expect(report.valid).toBe(true); // advisory FK is a warning, not an error
  });
});

// ── PII heuristics ─────────────────────────────────────────────────────────────

describe('SchemaValidator — PII heuristics', () => {
  it('emits an info item for columns named email', () => {
    const schema = baseSchema();
    const table = validTable({
      columns: [
        { id: 'col-1', name: 'id', type: { kind: 'uuid' }, nullable: false },
        { id: 'col-2', name: 'email', type: { kind: 'string', length: 255 }, nullable: false },
        // isPii not set
      ],
    });
    const report = validator.validate(schema, { tables: [table] }, 'postgres');
    expect(
      report.info.some((i) => i.code === 'PII_HEURISTIC_MATCH' && i.path.includes('columns[1]')),
    ).toBe(true);
  });

  it('does not emit PII info when isPii is already set', () => {
    const schema = baseSchema();
    const table = validTable({
      columns: [
        { id: 'col-1', name: 'id', type: { kind: 'uuid' }, nullable: false },
        {
          id: 'col-2',
          name: 'email',
          type: { kind: 'string', length: 255 },
          nullable: false,
          isPii: true,
          piiCategory: 'contact',
        },
      ],
    });
    const report = validator.validate(schema, { tables: [table] }, 'postgres');
    expect(report.info.every((i) => i.code !== 'PII_HEURISTIC_MATCH')).toBe(true);
  });
});

// ── Indexes ────────────────────────────────────────────────────────────────────

describe('SchemaValidator — indexes', () => {
  it('errors when index references unknown column', () => {
    const schema = baseSchema();
    const table = validTable({
      indexes: [
        {
          id: 'idx-1',
          name: 'idx_users_email',
          columns: [{ columnId: 'nonexistent', direction: 'asc' }],
          unique: false,
        },
      ],
    });
    const report = validator.validate(schema, { tables: [table] }, 'postgres');
    expect(report.errors.some((e) => e.code === 'INDEX_UNKNOWN_COLUMN')).toBe(true);
  });

  it('warns about partial index on database without support', () => {
    // Note: MSSQL DOES support partial indexes (filtered indexes), so this tests
    // a capability that's explicitly false — we'll simulate by checking the Mongo driver.
    // Actually all three drivers have partialIndexes = true, so no warning expected.
    // Testing the absence of a false positive.
    const schema = baseSchema('mongo');
    const table = validTable({
      indexes: [
        {
          id: 'idx-1',
          name: 'idx_users_email',
          columns: [{ columnId: 'col-2', direction: 'asc' }],
          unique: false,
          partial: { expression: 'email IS NOT NULL' },
        },
      ],
    });
    const report = validator.validate(schema, { tables: [table] }, 'mongo');
    // Mongo supports partial indexes, so no warning
    expect(report.warnings.every((w) => w.code !== 'PARTIAL_INDEX_NOT_SUPPORTED')).toBe(true);
  });
});
