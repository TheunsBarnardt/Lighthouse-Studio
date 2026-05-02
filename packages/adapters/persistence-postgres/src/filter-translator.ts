import type { Filter } from '@platform/ports-persistence';
import type { Result } from 'neverthrow';

import { err, ok } from 'neverthrow';

// ── Public types ─────────────────────────────────────────────────────────────

export interface TranslatedFilter {
  /** Parameterised WHERE clause fragment, e.g. `"name" = $1 AND "_version" > $2`. */
  sql: string;
  /** Positional parameter values that correspond to $1, $2, … in the SQL fragment. */
  params: unknown[];
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
  return value.replace(/[%_\\]/g, '\\$&');
}

// Pushes value to params array and returns the $N placeholder string.
function p(params: unknown[], value: unknown): string {
  params.push(value);
  return `$${String(params.length)}`;
}

// ── Field predicate translation ───────────────────────────────────────────────

function translateFieldPredicate(
  column: string,
  value: unknown,
  params: unknown[],
): Result<string, FilterTranslationError> {
  const quotedCol = `"${column}"`;

  // Direct null → IS NULL
  if (value === null || value === undefined) {
    return ok(`${quotedCol} IS NULL`);
  }

  // Non-object (primitive) or array → direct equality
  if (typeof value !== 'object' || Array.isArray(value)) {
    return ok(`${quotedCol} = ${p(params, value)}`);
  }

  // Object — check for operator keys
  if (!isOperatorObject(value)) {
    // Treat as a plain object value (for jsonb columns etc.) — direct equality
    return ok(`${quotedCol} = ${p(params, JSON.stringify(value))}`);
  }

  // isOperatorObject narrows value to Record<string, unknown>
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
    if (arr.length === 0) return ok('FALSE');
    return ok(`${quotedCol} = ANY(${p(params, arr)})`);
  }
  if ('_nin' in op) {
    const arr = op['_nin'] as unknown[];
    if (!Array.isArray(arr)) {
      return err(new FilterTranslationError(`_nin value must be an array on column "${column}"`));
    }
    if (arr.length === 0) return ok('TRUE');
    return ok(`${quotedCol} <> ALL(${p(params, arr)})`);
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
    return ok(`${quotedCol} LIKE ${p(params, `%${escapeLike(raw)}%`)}`);
  }
  if ('_icontains' in op) {
    const raw = op['_icontains'];
    if (typeof raw !== 'string') {
      return err(
        new FilterTranslationError(`_icontains value must be a string on column "${column}"`),
      );
    }
    return ok(`${quotedCol} ILIKE ${p(params, `%${escapeLike(raw)}%`)}`);
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
  params: unknown[],
): Result<string, FilterTranslationError> {
  // Logical: _and
  if ('_and' in filter) {
    const children = (filter as { _and: Filter<T>[] })._and;
    if (children.length === 0) return ok('TRUE');
    const parts: string[] = [];
    for (const child of children) {
      const r = translateNode(child, validColumns, params);
      if (r.isErr()) return r;
      parts.push(`(${r.value})`);
    }
    return ok(parts.join(' AND '));
  }

  // Logical: _or
  if ('_or' in filter) {
    const children = (filter as { _or: Filter<T>[] })._or;
    if (children.length === 0) return ok('FALSE');
    const parts: string[] = [];
    for (const child of children) {
      const r = translateNode(child, validColumns, params);
      if (r.isErr()) return r;
      parts.push(`(${r.value})`);
    }
    return ok(parts.join(' OR '));
  }

  // Logical: _not
  if ('_not' in filter) {
    const inner = (filter as { _not: Filter<T> })._not;
    const r = translateNode(inner, validColumns, params);
    if (r.isErr()) return r;
    return ok(`NOT (${r.value})`);
  }

  // FieldFilter: iterate over entries
  const fieldFilter = filter as Record<string, unknown>;
  const clauses: string[] = [];

  for (const [field, value] of Object.entries(fieldFilter)) {
    if (LOGICAL_KEYS.has(field)) continue; // shouldn't happen but guard anyway

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

  return ok(clauses.length === 0 ? 'TRUE' : clauses.join(' AND '));
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Translate a Filter<T> AST into a parameterised WHERE clause.
 *
 * Critical properties:
 * - Every value is a bind parameter ($1, $2, …) — never string-concatenated.
 * - Field names are validated against `validColumns`; unknown columns return an error.
 * - Null semantics: `_eq: null` → IS NULL; `_neq: null` → IS NOT NULL.
 * - The returned `params` array grows in-place; pass an existing array to share parameters
 *   with a larger query.
 */
export function translateFilter<T>(
  filter: Filter<T>,
  validColumns: ReadonlyArray<string>,
  params: unknown[] = [],
): Result<TranslatedFilter, FilterTranslationError> {
  const result = translateNode(filter, validColumns, params);
  if (result.isErr()) return err(result.error);
  return ok({ sql: result.value, params });
}
