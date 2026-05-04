import type { CustomerRow } from '@platform/ports-persistence';
import type { Filter } from '@platform/ports-persistence';
import type { Result } from 'neverthrow';

import { err, ok } from 'neverthrow';

import type { CustomerTableDefinition, ColumnDefinition, NormalizedType } from './schema-model.js';

// ── Public types ───────────────────────────────────────────────────────────────

export interface FilterParseError {
  field?: string;
  operator?: string;
  reason: 'unknown_field' | 'invalid_operator' | 'invalid_value' | 'too_complex' | 'malformed';
  message: string;
}

export interface FilterParser {
  parse(
    queryParams: Record<string, string | string[]>,
    table: CustomerTableDefinition,
  ): Result<Filter<CustomerRow> | undefined, FilterParseError>;
}

// ── Constants ──────────────────────────────────────────────────────────────────

// MAX_DEPTH reserved for future nested logical operator support
const MAX_CONDITIONS = 100;

const SCALAR_OPERATORS = new Set([
  '_eq',
  '_neq',
  '_lt',
  '_lte',
  '_gt',
  '_gte',
  '_contains',
  '_icontains',
  '_starts_with',
  '_ends_with',
]);

const ARRAY_OPERATORS = new Set(['_in', '_nin']);
const BOOLEAN_OPERATORS = new Set(['_is_null']);
const LOGICAL_OPERATORS = new Set(['_and', '_or', '_not']);

// Operators valid per type category
const NUMERIC_TYPES: ReadonlySet<NormalizedType['kind']> = new Set([
  'integer',
  'bigint',
  'decimal',
  'date',
  'timestamp',
  'timestamp_tz',
]);
const STRING_TYPES: ReadonlySet<NormalizedType['kind']> = new Set(['string', 'text', 'uuid']);

// ── Implementation ─────────────────────────────────────────────────────────────

export class FilterParserImpl implements FilterParser {
  parse(
    queryParams: Record<string, string | string[]>,
    table: CustomerTableDefinition,
  ): Result<Filter<CustomerRow> | undefined, FilterParseError> {
    const columnMap = new Map<string, ColumnDefinition>(table.columns.map((c) => [c.name, c]));

    // Collect all filter[...] entries from query params
    const filterEntries: Array<[string, string]> = [];
    for (const [key, value] of Object.entries(queryParams)) {
      if (!key.startsWith('filter[')) continue;
      const strValue = Array.isArray(value) ? (value[0] ?? '') : value;
      filterEntries.push([key, strValue]);
    }

    if (filterEntries.length === 0) {
      return ok(undefined);
    }

    if (filterEntries.length > MAX_CONDITIONS) {
      return err({
        reason: 'too_complex',
        message: `Filter exceeds maximum condition count (${String(MAX_CONDITIONS)}). Split into multiple requests.`,
      });
    }

    // Group by top-level bracket key: filter[field][op] → { field → { op → value } }
    const grouped = new Map<string, Map<string, string>>();
    for (const [key, value] of filterEntries) {
      const parsed = parseBracketKey(key);
      if (!parsed) {
        return err({ reason: 'malformed', message: `Invalid filter parameter: ${key}` });
      }
      const [first, second] = parsed;
      if (!grouped.has(first)) grouped.set(first, new Map());
      if (second !== undefined) {
        const opMap = grouped.get(first);
        if (opMap) opMap.set(second, value);
      }
    }

    const conditions: Filter<CustomerRow>[] = [];
    let conditionCount = 0;

    for (const [field, opMap] of grouped) {
      for (const [operator, rawValue] of opMap) {
        conditionCount++;
        if (conditionCount > MAX_CONDITIONS) {
          return err({
            reason: 'too_complex',
            message: `Filter exceeds maximum condition count (${String(MAX_CONDITIONS)}).`,
          });
        }

        if (LOGICAL_OPERATORS.has(field)) {
          return err({
            reason: 'malformed',
            message: `Nested logical operators in flat filter syntax are not supported. Use filter[_and][0][field][op]=value.`,
          });
        }

        const col = columnMap.get(field);
        if (!col) {
          return err({
            field,
            reason: 'unknown_field',
            message: `Unknown field '${field}'. Valid fields: ${[...columnMap.keys()].join(', ')}.`,
          });
        }

        const opResult = validateOperator(operator, col, rawValue);
        if (opResult.isErr()) return err(opResult.error);

        const valueResult = coerceValue(rawValue, operator, col);
        if (valueResult.isErr()) return err(valueResult.error);

        conditions.push({ [field]: { [operator]: valueResult.value } } as Filter<CustomerRow>);
      }
    }

    if (conditions.length === 0) return ok(undefined);
    if (conditions.length === 1) return ok(conditions[0] as Filter<CustomerRow>);
    return ok({ _and: conditions });
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Parse `filter[field][_eq]` → ['field', '_eq'] */
function parseBracketKey(key: string): [string, string | undefined] | null {
  // key = "filter[field][_eq]"
  const withoutPrefix = key.slice('filter['.length);
  const firstClose = withoutPrefix.indexOf(']');
  if (firstClose === -1) return null;

  const first = withoutPrefix.slice(0, firstClose);
  if (!first) return null;

  const rest = withoutPrefix.slice(firstClose + 1);
  if (!rest) return [first, undefined];

  // rest = "[_eq]"
  if (!rest.startsWith('[') || !rest.endsWith(']')) return null;
  const second = rest.slice(1, -1);
  if (!second) return null;

  return [first, second];
}

function validateOperator(
  operator: string,
  col: ColumnDefinition,
  _rawValue: string,
): Result<void, FilterParseError> {
  const kind = col.type.kind;

  if (
    SCALAR_OPERATORS.has(operator) ||
    ARRAY_OPERATORS.has(operator) ||
    BOOLEAN_OPERATORS.has(operator)
  ) {
    // Ordering operators only valid on comparable types
    if (['_lt', '_lte', '_gt', '_gte'].includes(operator)) {
      if (!NUMERIC_TYPES.has(kind) && !STRING_TYPES.has(kind)) {
        return err({
          field: col.name,
          operator,
          reason: 'invalid_operator',
          message: `Operator '${operator}' is not valid for column type '${kind}'.`,
        });
      }
    }

    // String operators only valid on string types
    if (['_contains', '_icontains', '_starts_with', '_ends_with'].includes(operator)) {
      if (!STRING_TYPES.has(kind)) {
        return err({
          field: col.name,
          operator,
          reason: 'invalid_operator',
          message: `Operator '${operator}' requires a string column type; '${col.name}' is '${kind}'.`,
        });
      }
    }

    return ok(undefined);
  }

  return err({
    field: col.name,
    operator,
    reason: 'invalid_operator',
    message: `Unknown operator '${operator}'. Valid operators: ${[
      ...SCALAR_OPERATORS,
      ...ARRAY_OPERATORS,
      ...BOOLEAN_OPERATORS,
    ].join(', ')}.`,
  });
}

function coerceValue(
  raw: string,
  operator: string,
  col: ColumnDefinition,
): Result<unknown, FilterParseError> {
  const kind = col.type.kind;

  if (operator === '_is_null') {
    if (raw !== 'true' && raw !== 'false') {
      return err({
        field: col.name,
        operator,
        reason: 'invalid_value',
        message: `'_is_null' requires 'true' or 'false', got '${raw}'.`,
      });
    }
    return ok(raw === 'true');
  }

  if (ARRAY_OPERATORS.has(operator)) {
    // Comma-separated list
    const items = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const coerced: unknown[] = [];
    for (const item of items) {
      const r = coerceScalar(item, kind, col.name, operator);
      if (r.isErr()) return err(r.error);
      coerced.push(r.value);
    }
    return ok(coerced);
  }

  return coerceScalar(raw, kind, col.name, operator);
}

function coerceScalar(
  raw: string,
  kind: NormalizedType['kind'],
  fieldName: string,
  operator: string,
): Result<unknown, FilterParseError> {
  switch (kind) {
    case 'integer':
    case 'bigint': {
      const n = Number(raw);
      if (!Number.isInteger(n) || raw.trim() === '') {
        return err({
          field: fieldName,
          operator,
          reason: 'invalid_value',
          message: `Expected integer for '${fieldName}', got '${raw}'.`,
        });
      }
      return ok(n);
    }
    case 'decimal': {
      const n = parseFloat(raw);
      if (isNaN(n) || raw.trim() === '') {
        return err({
          field: fieldName,
          operator,
          reason: 'invalid_value',
          message: `Expected decimal for '${fieldName}', got '${raw}'.`,
        });
      }
      return ok(n);
    }
    case 'boolean': {
      if (raw !== 'true' && raw !== 'false') {
        return err({
          field: fieldName,
          operator,
          reason: 'invalid_value',
          message: `Expected 'true' or 'false' for boolean '${fieldName}', got '${raw}'.`,
        });
      }
      return ok(raw === 'true');
    }
    case 'uuid': {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)) {
        return err({
          field: fieldName,
          operator,
          reason: 'invalid_value',
          message: `Expected UUID for '${fieldName}', got '${raw}'.`,
        });
      }
      return ok(raw);
    }
    case 'date':
    case 'timestamp':
    case 'timestamp_tz': {
      const d = new Date(raw);
      if (isNaN(d.getTime())) {
        return err({
          field: fieldName,
          operator,
          reason: 'invalid_value',
          message: `Expected ISO 8601 date for '${fieldName}', got '${raw}'.`,
        });
      }
      return ok(d.toISOString());
    }
    // string, text, binary, json, array — pass through as string
    default:
      return ok(raw);
  }
}
