import type { Filter } from '@platform/ports-persistence';

import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { FilterTranslationError, translateFilter } from '../src/filter-translator.js';

interface TestEntity {
  id: string;
  name: string;
  value: number;
  active: boolean;
  tag: string | null;
}

const VALID_COLUMNS: ReadonlyArray<string> = ['id', 'name', 'value', 'active', 'tag'];

// ── Unit tests ────────────────────────────────────────────────────────────────

describe('translateFilter', () => {
  it('translates an empty FieldFilter to TRUE', () => {
    const result = translateFilter<TestEntity>({}, VALID_COLUMNS);
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().sql).toBe('TRUE');
    expect(result._unsafeUnwrap().params).toEqual([]);
  });

  it('translates a direct equality value', () => {
    const filter: Filter<TestEntity> = { name: 'hello' };
    const result = translateFilter(filter, VALID_COLUMNS);
    expect(result.isOk()).toBe(true);
    const { sql, params } = result._unsafeUnwrap();
    expect(sql).toBe('"name" = $1');
    expect(params).toEqual(['hello']);
  });

  it('translates _eq', () => {
    const filter: Filter<TestEntity> = { value: { _eq: 42 } };
    const { sql, params } = translateFilter(filter, VALID_COLUMNS)._unsafeUnwrap();
    expect(sql).toBe('"value" = $1');
    expect(params).toEqual([42]);
  });

  it('translates _eq null to IS NULL', () => {
    const filter: Filter<TestEntity> = { tag: { _eq: null } };
    const { sql, params } = translateFilter(filter, VALID_COLUMNS)._unsafeUnwrap();
    expect(sql).toBe('"tag" IS NULL');
    expect(params).toEqual([]);
  });

  it('translates _neq null to IS NOT NULL', () => {
    const filter: Filter<TestEntity> = { tag: { _neq: null } };
    const { sql } = translateFilter(filter, VALID_COLUMNS)._unsafeUnwrap();
    expect(sql).toBe('"tag" IS NOT NULL');
  });

  it('translates _neq', () => {
    const filter: Filter<TestEntity> = { value: { _neq: 0 } };
    const { sql, params } = translateFilter(filter, VALID_COLUMNS)._unsafeUnwrap();
    expect(sql).toBe('"value" <> $1');
    expect(params).toEqual([0]);
  });

  it('translates _in', () => {
    const filter: Filter<TestEntity> = { value: { _in: [1, 2, 3] } };
    const { sql, params } = translateFilter(filter, VALID_COLUMNS)._unsafeUnwrap();
    expect(sql).toBe('"value" = ANY($1)');
    expect(params).toEqual([[1, 2, 3]]);
  });

  it('translates empty _in to FALSE', () => {
    const filter: Filter<TestEntity> = { value: { _in: [] } };
    const { sql } = translateFilter(filter, VALID_COLUMNS)._unsafeUnwrap();
    expect(sql).toBe('FALSE');
  });

  it('translates _nin', () => {
    const filter: Filter<TestEntity> = { value: { _nin: [5, 6] } };
    const { sql, params } = translateFilter(filter, VALID_COLUMNS)._unsafeUnwrap();
    expect(sql).toBe('"value" <> ALL($1)');
    expect(params).toEqual([[5, 6]]);
  });

  it('translates empty _nin to TRUE', () => {
    const filter: Filter<TestEntity> = { value: { _nin: [] } };
    const { sql } = translateFilter(filter, VALID_COLUMNS)._unsafeUnwrap();
    expect(sql).toBe('TRUE');
  });

  it('translates _lt, _lte, _gt, _gte', () => {
    expect(
      translateFilter<TestEntity>({ value: { _lt: 10 } }, VALID_COLUMNS)._unsafeUnwrap().sql,
    ).toBe('"value" < $1');
    expect(
      translateFilter<TestEntity>({ value: { _lte: 10 } }, VALID_COLUMNS)._unsafeUnwrap().sql,
    ).toBe('"value" <= $1');
    expect(
      translateFilter<TestEntity>({ value: { _gt: 10 } }, VALID_COLUMNS)._unsafeUnwrap().sql,
    ).toBe('"value" > $1');
    expect(
      translateFilter<TestEntity>({ value: { _gte: 10 } }, VALID_COLUMNS)._unsafeUnwrap().sql,
    ).toBe('"value" >= $1');
  });

  it('translates _contains with LIKE and escaped pattern', () => {
    const filter: Filter<TestEntity> = { name: { _contains: 'fo%o' } };
    const { sql, params } = translateFilter(filter, VALID_COLUMNS)._unsafeUnwrap();
    expect(sql).toBe('"name" LIKE $1');
    expect(params[0]).toBe('%fo\\%o%');
  });

  it('translates _icontains with ILIKE', () => {
    const filter: Filter<TestEntity> = { name: { _icontains: 'hello' } };
    const { sql } = translateFilter(filter, VALID_COLUMNS)._unsafeUnwrap();
    expect(sql).toBe('"name" ILIKE $1');
  });

  it('translates _starts_with', () => {
    const filter: Filter<TestEntity> = { name: { _starts_with: 'pre' } };
    const { sql, params } = translateFilter(filter, VALID_COLUMNS)._unsafeUnwrap();
    expect(sql).toBe('"name" LIKE $1');
    expect(params[0]).toBe('pre%');
  });

  it('translates _ends_with', () => {
    const filter: Filter<TestEntity> = { name: { _ends_with: 'fix' } };
    const { sql, params } = translateFilter(filter, VALID_COLUMNS)._unsafeUnwrap();
    expect(sql).toBe('"name" LIKE $1');
    expect(params[0]).toBe('%fix');
  });

  it('translates _is_null: true', () => {
    const filter: Filter<TestEntity> = { tag: { _is_null: true } };
    const { sql } = translateFilter(filter, VALID_COLUMNS)._unsafeUnwrap();
    expect(sql).toBe('"tag" IS NULL');
  });

  it('translates _is_null: false', () => {
    const filter: Filter<TestEntity> = { tag: { _is_null: false } };
    const { sql } = translateFilter(filter, VALID_COLUMNS)._unsafeUnwrap();
    expect(sql).toBe('"tag" IS NOT NULL');
  });

  it('translates _and', () => {
    const filter: Filter<TestEntity> = {
      _and: [{ name: 'a' }, { value: { _gt: 5 } }],
    };
    const { sql, params } = translateFilter(filter, VALID_COLUMNS)._unsafeUnwrap();
    expect(sql).toBe('("name" = $1) AND ("value" > $2)');
    expect(params).toEqual(['a', 5]);
  });

  it('translates empty _and to TRUE', () => {
    const filter: Filter<TestEntity> = { _and: [] };
    const { sql } = translateFilter(filter, VALID_COLUMNS)._unsafeUnwrap();
    expect(sql).toBe('TRUE');
  });

  it('translates _or', () => {
    const filter: Filter<TestEntity> = {
      _or: [{ name: 'a' }, { name: 'b' }],
    };
    const { sql } = translateFilter(filter, VALID_COLUMNS)._unsafeUnwrap();
    expect(sql).toBe('("name" = $1) OR ("name" = $2)');
  });

  it('translates empty _or to FALSE', () => {
    const filter: Filter<TestEntity> = { _or: [] };
    const { sql } = translateFilter(filter, VALID_COLUMNS)._unsafeUnwrap();
    expect(sql).toBe('FALSE');
  });

  it('translates _not', () => {
    const filter: Filter<TestEntity> = { _not: { name: 'x' } };
    const { sql } = translateFilter(filter, VALID_COLUMNS)._unsafeUnwrap();
    expect(sql).toBe('NOT ("name" = $1)');
  });

  it('rejects unknown column names', () => {
    const filter = { unknown_column: 'x' } as unknown as Filter<TestEntity>;
    const result = translateFilter(filter, VALID_COLUMNS);
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(FilterTranslationError);
  });

  it('produces shared param array when provided', () => {
    const sharedParams: unknown[] = ['existing'];
    const filter: Filter<TestEntity> = { name: 'new' };
    const { sql, params } = translateFilter(filter, VALID_COLUMNS, sharedParams)._unsafeUnwrap();
    expect(sql).toBe('"name" = $2');
    expect(params).toBe(sharedParams);
    expect(params).toEqual(['existing', 'new']);
  });
});

// ── Property-based tests ──────────────────────────────────────────────────────

describe('translateFilter — property-based', () => {
  const safeStrings = fc.string({ minLength: 1, maxLength: 50 }).filter((s) => !s.includes('\0'));
  const safeNumbers = fc.integer({ min: -1_000_000, max: 1_000_000 });

  const fieldFilterArb: fc.Arbitrary<Filter<TestEntity>> = fc.oneof(
    fc.record({ name: safeStrings }),
    fc.record({ value: safeNumbers }),
    fc.record({ active: fc.boolean() }),
    fc.record({ name: fc.record({ _eq: safeStrings }) }),
    fc.record({ value: fc.record({ _gt: safeNumbers }) }),
    fc.record({ value: fc.record({ _in: fc.array(safeNumbers, { minLength: 0, maxLength: 5 }) }) }),
    fc.record({ name: fc.record({ _contains: safeStrings }) }),
    fc.record({ name: fc.record({ _icontains: safeStrings }) }),
    fc.record({ tag: fc.record({ _is_null: fc.boolean() }) }),
  );

  it('never inlines a value as a literal string in SQL', () => {
    fc.assert(
      fc.property(fieldFilterArb, (filter) => {
        const result = translateFilter(filter, VALID_COLUMNS);
        if (result.isErr()) return true; // validation rejection is fine

        const { sql, params } = result.value;

        // Every $N placeholder must have a corresponding param
        const placeholders = [...sql.matchAll(/\$(\d+)/g)].map((m) => parseInt(m[1] ?? '0', 10));
        const maxN = placeholders.length > 0 ? Math.max(...placeholders) : 0;
        expect(maxN).toBeLessThanOrEqual(params.length);

        // The SQL should not contain bare string values from params
        for (const param of params) {
          if (typeof param === 'string' && param.length > 2) {
            // The param value should not appear verbatim in the SQL (would indicate injection)
            const dangerous = !param.startsWith('%') && !param.endsWith('%');
            if (dangerous) {
              expect(sql).not.toContain(param);
            }
          }
        }

        return true;
      }),
      { numRuns: 500 },
    );
  });

  it('nested _and/_or produce valid SQL (no syntax errors in structure)', () => {
    const nestedArb: fc.Arbitrary<Filter<TestEntity>> = fc.oneof(
      fieldFilterArb,
      fc.record({
        _and: fc.array(fieldFilterArb, { minLength: 0, maxLength: 3 }),
      }),
      fc.record({
        _or: fc.array(fieldFilterArb, { minLength: 0, maxLength: 3 }),
      }),
      fc.record({ _not: fieldFilterArb }),
    );

    fc.assert(
      fc.property(nestedArb, (filter) => {
        const result = translateFilter(filter, VALID_COLUMNS);
        if (result.isErr()) return true;

        const { sql, params } = result.value;

        // Balanced parentheses check
        let depth = 0;
        for (const ch of sql) {
          if (ch === '(') depth++;
          if (ch === ')') depth--;
          expect(depth).toBeGreaterThanOrEqual(0);
        }
        expect(depth).toBe(0);

        // Params are non-negative indexed
        const placeholders = [...sql.matchAll(/\$(\d+)/g)].map((m) => parseInt(m[1] ?? '0', 10));
        for (const n of placeholders) {
          expect(n).toBeGreaterThanOrEqual(1);
          expect(n).toBeLessThanOrEqual(params.length);
        }

        return true;
      }),
      { numRuns: 1000 },
    );
  });
});
