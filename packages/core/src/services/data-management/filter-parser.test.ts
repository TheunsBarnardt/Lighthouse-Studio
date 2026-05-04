import * as fc from 'fast-check';
import { describe, it, expect } from 'vitest';

import type { CustomerTableDefinition } from './schema-model.js';

import { FilterParserImpl } from './filter-parser.js';

const parser = new FilterParserImpl();

function table(overrides: Partial<CustomerTableDefinition> = {}): CustomerTableDefinition {
  return {
    id: 'tbl-1',
    name: 'users',
    columns: [
      { id: 'c1', name: 'id', type: { kind: 'uuid' }, nullable: false },
      { id: 'c2', name: 'email', type: { kind: 'string', length: 255 }, nullable: false },
      { id: 'c3', name: 'age', type: { kind: 'integer' }, nullable: true },
      {
        id: 'c4',
        name: 'score',
        type: { kind: 'decimal', precision: 5, scale: 2 },
        nullable: true,
      },
      { id: 'c5', name: 'active', type: { kind: 'boolean' }, nullable: false },
      { id: 'c6', name: 'created_at', type: { kind: 'timestamp_tz' }, nullable: false },
      { id: 'c7', name: 'notes', type: { kind: 'text' }, nullable: true },
    ],
    indexes: [],
    foreignKeys: [],
    constraints: [],
    primaryKey: { kind: 'single', columnId: 'c1' },
    ...overrides,
  };
}

// ── No filter ──────────────────────────────────────────────────────────────────

describe('FilterParser — no filter', () => {
  it('returns undefined when no filter params present', () => {
    const result = parser.parse({ limit: '10', offset: '0' }, table());
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toBeUndefined();
  });

  it('returns undefined for empty query params', () => {
    const result = parser.parse({}, table());
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toBeUndefined();
  });
});

// ── Scalar operators ───────────────────────────────────────────────────────────

describe('FilterParser — scalar operators', () => {
  it('parses _eq on a string column', () => {
    const result = parser.parse({ 'filter[email][_eq]': 'alice@example.com' }, table());
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toEqual({ email: { _eq: 'alice@example.com' } });
  });

  it('parses _neq on a string column', () => {
    const result = parser.parse({ 'filter[email][_neq]': 'bob@example.com' }, table());
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toEqual({ email: { _neq: 'bob@example.com' } });
  });

  it('parses _eq on an integer column and coerces to number', () => {
    const result = parser.parse({ 'filter[age][_eq]': '30' }, table());
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toEqual({ age: { _eq: 30 } });
  });

  it('parses _lt and _gte on integer columns', () => {
    const r1 = parser.parse({ 'filter[age][_lt]': '18' }, table());
    const r2 = parser.parse({ 'filter[age][_gte]': '21' }, table());
    expect(r1._unsafeUnwrap()).toEqual({ age: { _lt: 18 } });
    expect(r2._unsafeUnwrap()).toEqual({ age: { _gte: 21 } });
  });

  it('parses _eq on a boolean column', () => {
    const result = parser.parse({ 'filter[active][_eq]': 'true' }, table());
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toEqual({ active: { _eq: true } });
  });

  it('parses _eq on a uuid column and validates format', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    const result = parser.parse({ 'filter[id][_eq]': uuid }, table());
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toEqual({ id: { _eq: uuid } });
  });

  it('parses _contains and _icontains on text columns', () => {
    const r1 = parser.parse({ 'filter[notes][_contains]': 'hello' }, table());
    const r2 = parser.parse({ 'filter[notes][_icontains]': 'HELLO' }, table());
    expect(r1._unsafeUnwrap()).toEqual({ notes: { _contains: 'hello' } });
    expect(r2._unsafeUnwrap()).toEqual({ notes: { _icontains: 'HELLO' } });
  });

  it('parses _starts_with and _ends_with on string columns', () => {
    const r1 = parser.parse({ 'filter[email][_starts_with]': 'alice' }, table());
    const r2 = parser.parse({ 'filter[email][_ends_with]': '.com' }, table());
    expect(r1._unsafeUnwrap()).toEqual({ email: { _starts_with: 'alice' } });
    expect(r2._unsafeUnwrap()).toEqual({ email: { _ends_with: '.com' } });
  });

  it('parses _is_null as boolean', () => {
    const r1 = parser.parse({ 'filter[age][_is_null]': 'true' }, table());
    const r2 = parser.parse({ 'filter[age][_is_null]': 'false' }, table());
    expect(r1._unsafeUnwrap()).toEqual({ age: { _is_null: true } });
    expect(r2._unsafeUnwrap()).toEqual({ age: { _is_null: false } });
  });
});

// ── Array operators ────────────────────────────────────────────────────────────

describe('FilterParser — array operators', () => {
  it('parses _in as a comma-separated list and coerces integers', () => {
    const result = parser.parse({ 'filter[age][_in]': '18,21,25' }, table());
    expect(result._unsafeUnwrap()).toEqual({ age: { _in: [18, 21, 25] } });
  });

  it('parses _nin for string values', () => {
    const result = parser.parse({ 'filter[email][_nin]': 'a@x.com,b@x.com' }, table());
    expect(result._unsafeUnwrap()).toEqual({ email: { _nin: ['a@x.com', 'b@x.com'] } });
  });
});

// ── Multiple conditions → _and ─────────────────────────────────────────────────

describe('FilterParser — multiple conditions', () => {
  it('combines two conditions with _and', () => {
    const result = parser.parse(
      { 'filter[age][_gte]': '18', 'filter[active][_eq]': 'true' },
      table(),
    );
    expect(result.isOk()).toBe(true);
    const f = result._unsafeUnwrap();
    expect(f).toHaveProperty('_and');
    expect((f as { _and: unknown[] })._and).toHaveLength(2);
  });
});

// ── Error cases ────────────────────────────────────────────────────────────────

describe('FilterParser — errors', () => {
  it('rejects an unknown field', () => {
    const result = parser.parse({ 'filter[nonexistent][_eq]': 'x' }, table());
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().reason).toBe('unknown_field');
    expect(result._unsafeUnwrapErr().field).toBe('nonexistent');
  });

  it('rejects an unknown operator', () => {
    const result = parser.parse({ 'filter[email][_like]': 'x' }, table());
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().reason).toBe('invalid_operator');
  });

  it('rejects _lt on a boolean column', () => {
    const result = parser.parse({ 'filter[active][_lt]': 'true' }, table());
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().reason).toBe('invalid_operator');
  });

  it('rejects _contains on an integer column', () => {
    const result = parser.parse({ 'filter[age][_contains]': 'foo' }, table());
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().reason).toBe('invalid_operator');
  });

  it('rejects a non-integer value for an integer column', () => {
    const result = parser.parse({ 'filter[age][_eq]': 'not_a_number' }, table());
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().reason).toBe('invalid_value');
  });

  it('rejects an invalid UUID', () => {
    const result = parser.parse({ 'filter[id][_eq]': 'not-a-uuid' }, table());
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().reason).toBe('invalid_value');
  });

  it('rejects _is_null with non-boolean string', () => {
    const result = parser.parse({ 'filter[age][_is_null]': 'yes' }, table());
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().reason).toBe('invalid_value');
  });

  it('rejects a bracket key missing the closing bracket', () => {
    const result = parser.parse({ 'filter[bad': 'x' }, table());
    // Starts with filter[ so the parser picks it up, then cannot parse it
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().reason).toBe('malformed');
  });
});

// ── DoS protection ─────────────────────────────────────────────────────────────

describe('FilterParser — complexity limits', () => {
  it('rejects when condition count exceeds MAX_CONDITIONS (100)', () => {
    const params: Record<string, string> = {};
    // Generate 101 filter entries using different suffixes on the email field value
    // We can only have one operator per field, so we need to trick it with many fields.
    // Since we only have 7 columns, we can't actually exceed 100 conditions with valid fields.
    // Instead, inject >100 filter[] keys (which will be rejected before field validation).
    for (let i = 0; i < 101; i++) {
      params[`filter[email_${i}][_eq]`] = `val${i}`;
    }
    const result = parser.parse(params, table());
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().reason).toBe('too_complex');
  });
});

// ── Property-based tests ───────────────────────────────────────────────────────

describe('FilterParser — property: unknown fields always rejected', () => {
  it('rejects any field name not in the schema', () => {
    const knownCols = new Set(['id', 'email', 'age', 'score', 'active', 'created_at', 'notes']);
    fc.assert(
      fc.property(
        // Generate strings that are not known column names
        fc
          .string({ minLength: 1, maxLength: 40 })
          .filter((s) => !knownCols.has(s) && /^[a-z_][a-z0-9_]*$/.test(s)),
        fc.constantFrom('_eq', '_neq', '_lt', '_gt', '_lte', '_gte'),
        (fieldName, operator) => {
          const result = parser.parse(
            { [`filter[${fieldName}][${operator}]`]: 'somevalue' },
            table(),
          );
          expect(result.isErr()).toBe(true);
          expect(result._unsafeUnwrapErr().reason).toBe('unknown_field');
        },
      ),
      { numRuns: 200 },
    );
  });
});

describe('FilterParser — property: valid string equality filters always accepted', () => {
  it('accepts _eq on any string column with arbitrary string values', () => {
    const stringCols = ['email', 'notes'] as const;
    fc.assert(
      fc.property(fc.constantFrom(...stringCols), fc.string({ maxLength: 200 }), (col, value) => {
        const result = parser.parse({ [`filter[${col}][_eq]`]: value }, table());
        expect(result.isOk()).toBe(true);
      }),
      { numRuns: 200 },
    );
  });
});

describe('FilterParser — property: non-numeric values on integer columns always rejected', () => {
  it('rejects non-numeric values for _eq on age (integer column)', () => {
    fc.assert(
      fc.property(
        // Strings that cannot be parsed as a finite number
        fc.string({ minLength: 1 }).filter((s) => !Number.isFinite(Number(s))),
        (value) => {
          const result = parser.parse({ 'filter[age][_eq]': value }, table());
          expect(result.isErr()).toBe(true);
          expect(result._unsafeUnwrapErr().reason).toBe('invalid_value');
        },
      ),
      { numRuns: 200 },
    );
  });
});

describe('FilterParser — property: result is always Ok or Err, never throws', () => {
  it('parse never throws regardless of arbitrary query param inputs', () => {
    fc.assert(
      fc.property(
        fc.dictionary(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.oneof(fc.string({ maxLength: 100 }), fc.constant('')),
        ),
        (queryParams) => {
          expect(() => parser.parse(queryParams, table())).not.toThrow();
        },
      ),
      { numRuns: 500 },
    );
  });
});
