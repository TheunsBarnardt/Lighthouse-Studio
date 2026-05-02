import { integer, timestamp, uuid } from 'drizzle-orm/pg-core';
import { uuidv7 } from 'uuidv7';

/**
 * Standard lifecycle columns present on every platform entity table.
 * Spread these into every pgTable definition.
 */
export const standardColumns = {
  id: uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  /** Incremented on every update — used for optimistic locking. */
  version: integer('_version').notNull().default(1),
  /** Soft-delete timestamp. NULL means the row is live. */
  archivedAt: timestamp('_archived_at', { withTimezone: true }),
  createdAt: timestamp('_created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('_updated_at', { withTimezone: true }).notNull().defaultNow(),
  /** FK to the user who created this row; nullable for system-generated rows. */
  createdBy: uuid('_created_by'),
  updatedBy: uuid('_updated_by'),
} as const;

/**
 * Workspace tenancy column.
 * Every workspace-scoped table adds this alongside standardColumns.
 */
export const tenantColumns = {
  workspaceId: uuid('workspace_id').notNull(),
} as const;
