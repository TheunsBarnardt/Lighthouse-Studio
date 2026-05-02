import type { Filter } from '@platform/ports-persistence';
import type { Result } from 'neverthrow';

import { err, ok } from 'neverthrow';

// ── Public types ─────────────────────────────────────────────────────────────

export interface TranslatedFilter {
  /** T-SQL WHERE clause fragment using @p0, @p1, … named parameters. */
  sql: string;
  /** Parameter values keyed by name (p0, p1, …). */
  params: Record<string, unknown>;
}

export class FilterTranslationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FilterTranslationError';
  }
}

// ── Operator keys ─────────────────────────────────────────────────────────────

const LOGICAL_KEYS = new Set(['_and', '_or', '_not']);
const OPERATOR_KEYS = new Set([
  '_eq',
  '_neq',
  '_in',
  '_nin',
  '_lt',
  '_lte',
  '_gt',
  '_gte',
  '_contains',
  '_icontains',
  '_starts_with',
  '_ends_with',
  '_is_null',
]);

function isOperatorObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.keys(value).some((k) => OPERATOR_KEYS.has(k));
}

// ── LIKE escaping ─────────────────────────────────────────────────────────────

function escapeLike(value: string): string {
  // T-SQL LIKE special chars: % _ [ ]
  return value.replace(/[%_[\]]/g, '[$&]');
}

// Adds value to params map and returns @pN placeholder.
function p(params: Record<string, unknown>, value: unknown): string {
  const idx = Object.keys(params).length;
  const name = `p${String(idx)}`;
  params[name] = value;
  return `@${name}`;
}

// ── Field predicate translation ───────────────────────────────────────────────

function translateFieldPredicate(
  column: string,
  value: unknown,
  params: Record<string, unknown>,
): Result<string, FilterTranslationError> {
  // T-SQL uses square-bracket quoting
  const quotedCol = `[${column}]`;

  if (value === null || value === undefined) {
    return ok(`${quotedCol} IS NULL`);
  }

  if (typeof value !== 'object' || Array.isArray(value)) {
    return ok(`${quotedCol} = ${p(params, value)}`);
  }

  if (!isOperatorObject(value)) {
    return ok(`${quotedCol} = ${p(params, JSON.stringify(value))}`);
  }

  const op = value;

  if ('_eq' in op) {
    if (op['_eq'] === null) return ok(`${quotedCol} IS NULL`);
    return ok(`${quotedCol} = ${p(params, op['_eq'])}`);
  }
  if ('_neq' in op) {
    if (op['_neq'] === null) return ok(`${quotedCol} IS NOT NULL`);
    return ok(`${quotedCol} <> ${p(params, op['_neq'])}`);
  }
  if ('_in' in op) {
    const arr = op['_in'] as unknown[];
    if (!Array.isArray(arr)) {
      return err(new FilterTranslationError(`_in value must be an array on column "${column}"`));
    }
    if (arr.length === 0) return ok('1=0');
    // T-SQL: no ANY(); use IN with individual params
    const placeholders = arr.map((v) => p(params, v)).join(', ');
    return ok(`${quotedCol} IN (${placeholders})`);
  }
  if ('_nin' in op) {
    const arr = op['_nin'] as unknown[];
    if (!Array.isArray(arr)) {
      return err(new FilterTranslationError(`_nin value must be an array on column "${column}"`));
    }
    if (arr.length === 0) return ok('1=1');
    const placeholders = arr.map((v) => p(params, v)).join(', ');
    return ok(`${quotedCol} NOT IN (${placeholders})`);
  }
  if ('_lt' in op) return ok(`${quotedCol} < ${p(params, op['_lt'])}`);
  if ('_lte' in op) return ok(`${quotedCol} <= ${p(params, op['_lte'])}`);
  if ('_gt' in op) return ok(`${quotedCol} > ${p(params, op['_gt'])}`);
  if ('_gte' in op) return ok(`${quotedCol} >= ${p(params, op['_gte'])}`);
  if ('_contains' in op) {
    const raw = op['_contains'];
    if (typeof raw !== 'string') {
      return err(
        new FilterTranslationError(`_contains value must be a string on column "${column}"`),
      );
    }
    // T-SQL LIKE is case-insensitive by default on most collations
    return ok(`${quotedCol} LIKE ${p(params, `%${escapeLike(raw)}%`)}`);
  }
  if ('_icontains' in op) {
    const raw = op['_icontains'];
    if (typeof raw !== 'string') {
      return err(
        new FilterTranslationError(`_icontains value must be a string on column "${column}"`),
      );
    }
    // T-SQL LIKE is already case-insensitive on CI collations; LOWER() for explicit safety
    return ok(
      `LOWER(${quotedCol}) LIKE ${p(params, `%${escapeLike(raw.toLowerCase())}%`)} ESCAPE '\\'`,
    );
  }
  if ('_starts_with' in op) {
    const raw = op['_starts_with'];
    if (typeof raw !== 'string') {
      return err(
        new FilterTranslationError(`_starts_with value must be a string on column "${column}"`),
      );
    }
    return ok(`${quotedCol} LIKE ${p(params, `${escapeLike(raw)}%`)}`);
  }
  if ('_ends_with' in op) {
    const raw = op['_ends_with'];
    if (typeof raw !== 'string') {
      return err(
        new FilterTranslationError(`_ends_with value must be a string on column "${column}"`),
      );
    }
    return ok(`${quotedCol} LIKE ${p(params, `%${escapeLike(raw)}`)}`);
  }
  if ('_is_null' in op) {
    return ok(op['_is_null'] ? `${quotedCol} IS NULL` : `${quotedCol} IS NOT NULL`);
  }

  return err(new FilterTranslationError(`Unknown operator object on column "${column}"`));
}

// ── Recursive AST walker ──────────────────────────────────────────────────────

function translateNode<T>(
  filter: Filter<T>,
  validColumns: ReadonlyArray<string>,
  params: Record<string, unknown>,
): Result<string, FilterTranslationError> {
  if ('_and' in filter) {
    const children = (filter as { _and: Filter<T>[] })._and;
    if (children.length === 0) return ok('1=1');
    const parts: string[] = [];
    for (const child of children) {
      const r = translateNode(child, validColumns, params);
      if (r.isErr()) return r;
      parts.push(`(${r.value})`);
    }
    return ok(parts.join(' AND '));
  }

  if ('_or' in filter) {
    const children = (filter as { _or: Filter<T>[] })._or;
    if (children.length === 0) return ok('1=0');
    const parts: string[] = [];
    for (const child of children) {
      const r = translateNode(child, validColumns, params);
      if (r.isErr()) return r;
      parts.push(`(${r.value})`);
    }
    return ok(parts.join(' OR '));
  }

  if ('_not' in filter) {
    const inner = (filter as { _not: Filter<T> })._not;
    const r = translateNode(inner, validColumns, params);
    if (r.isErr()) return r;
    return ok(`NOT (${r.value})`);
  }

  const fieldFilter = filter as Record<string, unknown>;
  const clauses: string[] = [];

  for (const [field, value] of Object.entries(fieldFilter)) {
    if (LOGICAL_KEYS.has(field)) continue;

    if (!validColumns.includes(field)) {
      return err(
        new FilterTranslationError(
          `Unknown column "${field}". Valid columns: ${validColumns.join(', ')}`,
        ),
      );
    }

    const r = translateFieldPredicate(field, value, params);
    if (r.isErr()) return r;
    clauses.push(r.value);
  }

  return ok(clauses.length === 0 ? '1=1' : clauses.join(' AND '));
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Translate a Filter<T> AST into a parameterised T-SQL WHERE clause.
 *
 * Uses @pN named parameters (mssql package style).
 * Field names are validated against validColumns; unknown columns return an error.
 */
export function translateFilter<T>(
  filter: Filter<T>,
  validColumns: ReadonlyArray<string>,
  params: Record<string, unknown> = {},
): Result<TranslatedFilter, FilterTranslationError> {
  const result = translateNode(filter, validColumns, params);
  if (result.isErr()) return err(result.error);
  return ok({ sql: result.value, params });
}
