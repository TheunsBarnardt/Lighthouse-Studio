import { describe, it, expect } from 'vitest';

import type { CustomerSchema, TableDefinition } from './types';

import {
  findTableById,
  addTable,
  removeTable,
  addColumn,
  removeColumn,
  getCapabilityWarnings,
  generateId,
  newColumn,
  newTable,
  schemaToJson,
  normalizedTypeName,
} from './schema-utils';

const makeSchema = (tables: TableDefinition[] = []): CustomerSchema => ({
  id: 'schema-1',
  workspaceId: 'ws-1',
  name: 'Test',
  slug: 'test',
  version: 1,
  databaseDriver: 'postgres',
  tables,
  metadata: {
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    createdBy: 'u1',
    updatedBy: 'u1',
  },
});

const makeTable = (id: string, name: string): TableDefinition => ({
  id,
  name,
  columns: [],
  primaryKey: { kind: 'single', columnId: '' },
  indexes: [],
  foreignKeys: [],
  constraints: [],
});

describe('schema-utils', () => {
  describe('generateId', () => {
    it('produces unique IDs', () => {
      const a = generateId();
      const b = generateId();
      expect(a).not.toBe(b);
      expect(a.length).toBeGreaterThan(0);
    });
  });

  describe('findTableById', () => {
    it('finds existing table', () => {
      const t = makeTable('t1', 'users');
      const schema = makeSchema([t]);
      expect(findTableById(schema, 't1')).toBe(t);
    });

    it('returns undefined for missing table', () => {
      const schema = makeSchema([]);
      expect(findTableById(schema, 'nope')).toBeUndefined();
    });
  });

  describe('addTable', () => {
    it('appends a table and returns new schema', () => {
      const schema = makeSchema([]);
      const table = makeTable('t1', 'posts');
      const next = addTable(schema, table);
      expect(next.tables).toHaveLength(1);
      expect(next.tables[0]?.name).toBe('posts');
      expect(schema.tables).toHaveLength(0); // immutable
    });
  });

  describe('removeTable', () => {
    it('removes a table by id', () => {
      const schema = makeSchema([makeTable('t1', 'a'), makeTable('t2', 'b')]);
      const next = removeTable(schema, 't1');
      expect(next.tables).toHaveLength(1);
      expect(next.tables[0]?.id).toBe('t2');
    });
  });

  describe('addColumn + removeColumn', () => {
    it('adds a column to a table', () => {
      const table = makeTable('t1', 'users');
      const schema = makeSchema([table]);
      const col = newColumn('', 't1');
      const next = addColumn(schema, 't1', col);
      expect(next.tables[0]?.columns).toHaveLength(1);
    });

    it('removes a column from a table', () => {
      const col = newColumn('', 't1');
      const table = { ...makeTable('t1', 'users'), columns: [col] };
      const schema = makeSchema([table]);
      const next = removeColumn(schema, 't1', col.id);
      expect(next.tables[0]?.columns).toHaveLength(0);
    });
  });

  describe('getCapabilityWarnings', () => {
    it('warns about array columns on MSSQL', () => {
      const col = {
        ...newColumn('', 't1'),
        type: { kind: 'array' as const, elementType: { kind: 'string' as const } },
      };
      const table = { ...makeTable('t1', 'data'), columns: [col] };
      const schema = makeSchema([table]);
      const mssqlSchema = { ...schema, databaseDriver: 'mssql' as const };
      const warnings = getCapabilityWarnings(mssqlSchema);
      expect(warnings.some((w) => w.capability === 'arrays')).toBe(true);
    });

    it('returns no warnings for postgres with arrays', () => {
      const col = {
        ...newColumn('', 't1'),
        type: { kind: 'array' as const, elementType: { kind: 'string' as const } },
      };
      const table = { ...makeTable('t1', 'data'), columns: [col] };
      const schema = makeSchema([table]);
      const warnings = getCapabilityWarnings(schema);
      expect(warnings.filter((w) => w.capability === 'arrays')).toHaveLength(0);
    });
  });

  describe('newTable / newColumn', () => {
    it('newTable produces valid table structure', () => {
      const t = newTable('schema-1');
      expect(t.id).toBeTruthy();
      expect(t.name).toBe('new_table');
      expect(t.columns.length).toBeGreaterThanOrEqual(1); // at least id column
    });

    it('newColumn produces valid column', () => {
      const c = newColumn('', 't1');
      expect(c.id).toBeTruthy();
      expect(c.nullable).toBe(true);
    });
  });

  describe('schemaToJson', () => {
    it('produces valid JSON', () => {
      const schema = makeSchema([]);
      const json = schemaToJson(schema);
      expect(() => JSON.parse(json) as unknown).not.toThrow();
      const parsed = JSON.parse(json) as { name: string };
      expect(parsed.name).toBe('Test');
    });
  });

  describe('normalizedTypeName', () => {
    it('returns readable names', () => {
      expect(normalizedTypeName({ kind: 'string' })).toBe('varchar');
      expect(normalizedTypeName({ kind: 'integer' })).toBe('integer');
      expect(normalizedTypeName({ kind: 'array', elementType: { kind: 'text' } })).toBe('text[]');
    });
  });
});
