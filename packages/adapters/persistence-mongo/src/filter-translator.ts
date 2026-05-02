import type { Filter as PlatformFilter } from '@platform/ports-persistence';
import type { Filter as MongoFilter, Document } from 'mongodb';
import type { Result } from 'neverthrow';

import { err, ok } from 'neverthrow';

export class FilterTranslationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FilterTranslationError';
  }
}

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

function escapeLikeToRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function translateFieldPredicate(
  field: string,
  value: unknown,
): Result<Document, FilterTranslationError> {
  if (value === null || value === undefined) {
    return ok({ [field]: null });
  }

  if (typeof value !== 'object' || Array.isArray(value)) {
    return ok({ [field]: value });
  }

  if (!isOperatorObject(value)) {
    return ok({ [field]: value });
  }

  const op = value;

  if ('_eq' in op) {
    if (op['_eq'] === null) return ok({ [field]: null });
    return ok({ [field]: { $eq: op['_eq'] } });
  }
  if ('_neq' in op) {
    if (op['_neq'] === null) return ok({ [field]: { $ne: null } });
    return ok({ [field]: { $ne: op['_neq'] } });
  }
  if ('_in' in op) {
    const arr = op['_in'];
    if (!Array.isArray(arr)) {
      return err(new FilterTranslationError(`_in value must be an array on field "${field}"`));
    }
    return ok({ [field]: { $in: arr } });
  }
  if ('_nin' in op) {
    const arr = op['_nin'];
    if (!Array.isArray(arr)) {
      return err(new FilterTranslationError(`_nin value must be an array on field "${field}"`));
    }
    return ok({ [field]: { $nin: arr } });
  }
  if ('_lt' in op) return ok({ [field]: { $lt: op['_lt'] } });
  if ('_lte' in op) return ok({ [field]: { $lte: op['_lte'] } });
  if ('_gt' in op) return ok({ [field]: { $gt: op['_gt'] } });
  if ('_gte' in op) return ok({ [field]: { $gte: op['_gte'] } });
  if ('_contains' in op) {
    const raw = op['_contains'];
    if (typeof raw !== 'string') {
      return err(new FilterTranslationError(`_contains must be a string on field "${field}"`));
    }
    return ok({ [field]: { $regex: escapeLikeToRegex(raw), $options: '' } });
  }
  if ('_icontains' in op) {
    const raw = op['_icontains'];
    if (typeof raw !== 'string') {
      return err(new FilterTranslationError(`_icontains must be a string on field "${field}"`));
    }
    return ok({ [field]: { $regex: escapeLikeToRegex(raw), $options: 'i' } });
  }
  if ('_starts_with' in op) {
    const raw = op['_starts_with'];
    if (typeof raw !== 'string') {
      return err(new FilterTranslationError(`_starts_with must be a string on field "${field}"`));
    }
    return ok({ [field]: { $regex: `^${escapeLikeToRegex(raw)}` } });
  }
  if ('_ends_with' in op) {
    const raw = op['_ends_with'];
    if (typeof raw !== 'string') {
      return err(new FilterTranslationError(`_ends_with must be a string on field "${field}"`));
    }
    return ok({ [field]: { $regex: `${escapeLikeToRegex(raw)}$` } });
  }
  if ('_is_null' in op) {
    return ok(op['_is_null'] ? { [field]: null } : { [field]: { $ne: null } });
  }

  return err(new FilterTranslationError(`Unknown operator object on field "${field}"`));
}

function translateNode<T>(
  filter: PlatformFilter<T>,
  validFields: ReadonlyArray<string>,
): Result<Document, FilterTranslationError> {
  if ('_and' in filter) {
    const children = (filter as { _and: PlatformFilter<T>[] })._and;
    if (children.length === 0) return ok({});
    const parts: Document[] = [];
    for (const child of children) {
      const r = translateNode(child, validFields);
      if (r.isErr()) return r;
      parts.push(r.value);
    }
    return ok({ $and: parts });
  }

  if ('_or' in filter) {
    const children = (filter as { _or: PlatformFilter<T>[] })._or;
    if (children.length === 0) return ok({ _id: { $exists: false } }); // always false
    const parts: Document[] = [];
    for (const child of children) {
      const r = translateNode(child, validFields);
      if (r.isErr()) return r;
      parts.push(r.value);
    }
    return ok({ $or: parts });
  }

  if ('_not' in filter) {
    const inner = (filter as { _not: PlatformFilter<T> })._not;
    const r = translateNode(inner, validFields);
    if (r.isErr()) return r;
    return ok({ $nor: [r.value] });
  }

  const fieldFilter = filter as Record<string, unknown>;
  const result: Document = {};

  for (const [field, value] of Object.entries(fieldFilter)) {
    if (LOGICAL_KEYS.has(field)) continue;

    if (!validFields.includes(field)) {
      return err(
        new FilterTranslationError(
          `Unknown field "${field}". Valid fields: ${validFields.join(', ')}`,
        ),
      );
    }

    const r = translateFieldPredicate(field, value);
    if (r.isErr()) return r;
    Object.assign(result, r.value);
  }

  return ok(result);
}

/**
 * Translate a platform Filter<T> AST into a MongoDB filter document.
 */
export function translateFilter<T>(
  filter: PlatformFilter<T>,
  validFields: ReadonlyArray<string>,
): Result<MongoFilter<Document>, FilterTranslationError> {
  const result = translateNode(filter, validFields);
  if (result.isErr()) return err(result.error);
  return ok(result.value as MongoFilter<Document>);
}
