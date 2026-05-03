import { uuidv7 } from 'uuidv7';

/**
 * Standard lifecycle columns for every platform entity table in MSSQL.
 *
 * Use these column definitions when building CREATE TABLE statements via MssqlSchemaDdlAdapter
 * or raw SQL migrations.
 *
 * Key differences from the Postgres adapter:
 *   - id: UNIQUEIDENTIFIER (not uuid); client-side UUID v7 generation
 *   - _version: INT, not native ROWVERSION; see ADR-0083 for cross-DB parity rationale
 *   - _archived_at: DATETIME2(7) NULL (soft delete; same pattern)
 *   - _created_at / _updated_at: DATETIME2(7) with SYSUTCDATETIME() default
 */

export const STANDARD_COLUMN_DDL = {
  id: `[id] UNIQUEIDENTIFIER NOT NULL`,
  version: `[_version] INT NOT NULL DEFAULT 1`,
  archivedAt: `[_archived_at] DATETIME2(7) NULL`,
  createdAt: `[_created_at] DATETIME2(7) NOT NULL DEFAULT SYSUTCDATETIME()`,
  updatedAt: `[_updated_at] DATETIME2(7) NOT NULL DEFAULT SYSUTCDATETIME()`,
  createdBy: `[_created_by] UNIQUEIDENTIFIER NULL`,
  updatedBy: `[_updated_by] UNIQUEIDENTIFIER NULL`,
} as const;

export const TENANT_COLUMN_DDL = {
  workspaceId: `[workspace_id] UNIQUEIDENTIFIER NOT NULL`,
} as const;

/** Generate a new UUID v7 as the primary key for a new entity. */
export function newEntityId(): string {
  return uuidv7();
}
