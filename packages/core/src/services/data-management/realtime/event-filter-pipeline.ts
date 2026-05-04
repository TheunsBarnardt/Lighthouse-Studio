import type { RequestContext } from '@platform/ports-authorization';
import type { ChangeEvent } from '@platform/ports-eventing';
import type { Filter } from '@platform/ports-persistence';
import type { CustomerRow } from '@platform/ports-persistence';

import type { ColumnDefinition, CustomerTableDefinition, PiiCategory } from '../schema-model.js';
import type { PermissionCache } from './permission-cache.js';
import type { ActiveSubscription, DeliverableEvent } from './types.js';

// ── Filter evaluation (in-process) ─────────────────────────────────────────────

/**
 * Evaluate a Filter AST against a row object.
 * Returns true when the row matches the filter (or when filter is undefined).
 */
export function evaluateFilter(
  filter: Filter<CustomerRow> | undefined,
  row: Record<string, unknown>,
): boolean {
  if (filter === undefined) return true;

  // Logical operators
  if ('_and' in filter) {
    return (filter._and as Array<Filter<CustomerRow>>).every((f) => evaluateFilter(f, row));
  }
  if ('_or' in filter) {
    return (filter._or as Array<Filter<CustomerRow>>).some((f) => evaluateFilter(f, row));
  }
  if ('_not' in filter) {
    return !evaluateFilter(filter._not as Filter<CustomerRow>, row);
  }

  // Field conditions
  for (const [field, condition] of Object.entries(filter)) {
    const value = row[field];

    if (condition !== null && typeof condition === 'object' && !Array.isArray(condition)) {
      const ops = condition as Record<string, unknown>;
      for (const [op, operand] of Object.entries(ops)) {
        if (!evaluateOperator(op, value, operand)) return false;
      }
    } else {
      // Short-hand equality: { field: value }
      if (value !== condition) return false;
    }
  }

  return true;
}

function evaluateOperator(op: string, value: unknown, operand: unknown): boolean {
  switch (op) {
    case '_eq':
      return value === operand;
    case '_neq':
      return value !== operand;
    case '_lt':
      return typeof value === 'number' && typeof operand === 'number' && value < operand;
    case '_lte':
      return typeof value === 'number' && typeof operand === 'number' && value <= operand;
    case '_gt':
      return typeof value === 'number' && typeof operand === 'number' && value > operand;
    case '_gte':
      return typeof value === 'number' && typeof operand === 'number' && value >= operand;
    case '_in':
      return Array.isArray(operand) && operand.includes(value);
    case '_nin':
      return Array.isArray(operand) && !operand.includes(value);
    case '_contains':
      return typeof value === 'string' && typeof operand === 'string' && value.includes(operand);
    case '_icontains':
      return (
        typeof value === 'string' &&
        typeof operand === 'string' &&
        value.toLowerCase().includes(operand.toLowerCase())
      );
    case '_starts_with':
      return typeof value === 'string' && typeof operand === 'string' && value.startsWith(operand);
    case '_ends_with':
      return typeof value === 'string' && typeof operand === 'string' && value.endsWith(operand);
    case '_is_null':
      return operand === true ? value === null : value !== null;
    default:
      return true; // Unknown operator — don't filter
  }
}

// ── PII redaction ──────────────────────────────────────────────────────────────

/** Permission action for reading a PII category. */
function piiAction(category: PiiCategory): string {
  return `pii.read.${category}`;
}

/** Redact PII columns the subscriber cannot read. Mutates `row` in place. */
async function redactPii(
  row: Record<string, unknown>,
  tableDef: CustomerTableDefinition,
  ctx: RequestContext,
  permCache: PermissionCache,
): Promise<string[]> {
  const redacted: string[] = [];

  for (const col of tableDef.columns) {
    if (!col.isPii || !col.piiCategory) continue;
    if (!(col.name in row)) continue;

    const allowed = await permCache.check(ctx, piiAction(col.piiCategory), 'pii_column', col.id);
    if (!allowed) {
      row[col.name] = null;
      redacted.push(col.name);
    }
  }

  return redacted;
}

// ── Field projection ───────────────────────────────────────────────────────────

function projectFields(
  row: Record<string, unknown> | undefined,
  fields: string[] | undefined,
): Record<string, unknown> | undefined {
  if (!row || !fields || fields.length === 0) return row;
  const projected: Record<string, unknown> = {};
  for (const f of fields) {
    if (f in row) projected[f] = row[f];
  }
  return projected;
}

// ── Main pipeline ──────────────────────────────────────────────────────────────

export interface EventFilterPipeline {
  /**
   * Process one ChangeEvent for one subscription.
   * Returns the deliverable event or null if the event should be dropped.
   */
  process(
    event: ChangeEvent,
    subscription: ActiveSubscription,
    ctx: RequestContext,
    permCache: PermissionCache,
    kind?: 'data' | 'snapshot_row',
  ): Promise<DeliverableEvent | null>;
}

export class EventFilterPipelineImpl implements EventFilterPipeline {
  async process(
    event: ChangeEvent,
    subscription: ActiveSubscription,
    ctx: RequestContext,
    permCache: PermissionCache,
    kind: 'data' | 'snapshot_row' = 'data',
  ): Promise<DeliverableEvent | null> {
    // Step 1: Operation filter
    if (
      subscription.operations &&
      subscription.operations.length > 0 &&
      !subscription.operations.includes(event.operation)
    ) {
      return null;
    }

    // Determine the data row for filter evaluation
    const dataRow = event.operation === 'delete' ? event.before : event.after;

    // Step 2: Filter AST
    if (subscription.filter !== undefined) {
      const row = dataRow ?? {};
      if (!evaluateFilter(subscription.filter as Filter<CustomerRow>, row)) {
        return null;
      }
    }

    // Step 3: Per-row permission check
    const tableReadAllowed = await permCache.check(
      ctx,
      'data_table.read',
      'table',
      subscription.tableId,
    );
    if (!tableReadAllowed) {
      // Drop silently — subscriber not entitled to know this row exists
      return null;
    }

    // Step 4: PII redaction (mutates copies)
    const before = event.before ? { ...event.before } : undefined;
    const after = event.after ? { ...event.after } : undefined;

    const tableDef = subscription.tableDef;
    const hasPiiCols = tableDef.columns.some((c: ColumnDefinition) => c.isPii);

    let redacted: string[] = [];
    if (hasPiiCols) {
      if (before) {
        redacted = await redactPii(before, tableDef, ctx, permCache);
      }
      if (after) {
        const afterRedacted = await redactPii(after, tableDef, ctx, permCache);
        for (const r of afterRedacted) {
          if (!redacted.includes(r)) redacted.push(r);
        }
      }
    }

    // Step 5: Field projection
    const projectedBefore = projectFields(before, subscription.fields);
    const projectedAfter = projectFields(after, subscription.fields);

    const deliverable: DeliverableEvent = {
      subscriptionId: subscription.id,
      kind,
      operation: event.operation,
      table: event.table,
      before: projectedBefore,
      after: projectedAfter,
      position: event.position,
      occurredAt: event.occurredAt.toISOString(),
    };

    if (redacted.length > 0) {
      deliverable.redacted = redacted;
    }

    return deliverable;
  }
}
