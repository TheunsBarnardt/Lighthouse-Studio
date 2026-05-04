/**
 * Machine-readable capability matrix for the schema designer.
 *
 * This file is the authoritative source for which features each database driver
 * supports. The schema designer reads this at runtime and disables unsupported
 * controls with an explanation tooltip.
 *
 * Human-readable twin: docs/architecture/capability-matrix.md
 */

import type { DatabaseDriver } from './schema-model.js';
export type { DatabaseDriver };

export type CapabilityStatus =
  | { supported: true }
  | { supported: 'partial'; reason: string; workaround?: string }
  | { supported: false; reason: string; alternative?: string };

export interface CapabilityMatrix {
  // ── Schema designer features ─────────────────────────────────────────────
  arrayColumns: CapabilityStatus;
  computedColumns: CapabilityStatus;
  rowLevelSecurity: CapabilityStatus;
  enumTypes: CapabilityStatus;
  autoIncrement: CapabilityStatus;
  namedCheckConstraints: CapabilityStatus;
  foreignKeys: CapabilityStatus;
  ddlTransactions: CapabilityStatus;
  transactions: CapabilityStatus;

  // ── Migration capabilities ───────────────────────────────────────────────
  atomicRollback: CapabilityStatus;
  onlineIndexCreation: CapabilityStatus;

  // ── REST API capabilities ────────────────────────────────────────────────
  rowLevelSecurityOnApi: CapabilityStatus;
  foreignKeyFiltering: CapabilityStatus;
  /** Whether bulk-create/update/delete operations are wrapped in a single atomic transaction. */
  bulkOperationsAtomic: CapabilityStatus;
  /** Whether JSON/JSONB columns can be queried with dot-path filter operators (e.g. `filter[meta.key][_eq]=val`). */
  jsonColumnFiltering: CapabilityStatus;
}

const POSTGRES: CapabilityMatrix = {
  arrayColumns: { supported: true },
  computedColumns: { supported: true },
  rowLevelSecurity: { supported: true },
  enumTypes: { supported: true },
  autoIncrement: { supported: true },
  namedCheckConstraints: { supported: true },
  foreignKeys: { supported: true },
  ddlTransactions: { supported: true },
  transactions: { supported: true },
  atomicRollback: { supported: true },
  onlineIndexCreation: { supported: true },
  rowLevelSecurityOnApi: { supported: true },
  foreignKeyFiltering: { supported: true },
  bulkOperationsAtomic: { supported: true },
  jsonColumnFiltering: { supported: true },
};

const MSSQL: CapabilityMatrix = {
  arrayColumns: {
    supported: false,
    reason: "MSSQL doesn't support array column types.",
    alternative: 'Use a JSON column or a child table instead.',
  },
  computedColumns: { supported: true },
  rowLevelSecurity: {
    supported: false,
    reason: 'MSSQL does not support native row-level security on the generated API.',
    alternative: 'Use application-layer owner checks.',
  },
  enumTypes: {
    supported: 'partial',
    reason: 'MSSQL enforces enum values via CHECK constraints, not a native ENUM type.',
    workaround: 'A CHECK constraint is generated automatically.',
  },
  autoIncrement: { supported: true },
  namedCheckConstraints: { supported: true },
  foreignKeys: { supported: true },
  ddlTransactions: { supported: true },
  transactions: { supported: true },
  atomicRollback: { supported: true },
  onlineIndexCreation: { supported: true },
  rowLevelSecurityOnApi: {
    supported: false,
    reason: 'MSSQL has no native RLS; the API uses application-layer ownership checks.',
  },
  foreignKeyFiltering: { supported: true },
  bulkOperationsAtomic: { supported: true },
  jsonColumnFiltering: {
    supported: 'partial',
    reason: 'MSSQL JSON dot-path filtering requires a computed column index for performance.',
    workaround: 'Add a persisted computed column or use a full-text index on the JSON column.',
  },
};

const MONGO: CapabilityMatrix = {
  arrayColumns: { supported: true },
  computedColumns: {
    supported: false,
    reason: 'MongoDB does not support computed/generated columns.',
    alternative: 'Compute values in application code before saving.',
  },
  rowLevelSecurity: {
    supported: false,
    reason: 'MongoDB has no native row-level security.',
    alternative: 'Application-layer owner checks are used.',
  },
  enumTypes: {
    supported: false,
    reason: 'MongoDB is schema-less; enum validation is advisory only.',
    alternative: 'Application-layer validation enforces allowed values.',
  },
  autoIncrement: {
    supported: false,
    reason: 'MongoDB does not support auto-increment IDs.',
    alternative: 'Use ObjectId or a UUID string as the primary key.',
  },
  namedCheckConstraints: {
    supported: false,
    reason: 'MongoDB does not support named check constraints.',
    alternative: 'Enforce constraints in application code.',
  },
  foreignKeys: {
    supported: 'partial',
    reason:
      'Foreign keys are advisory on MongoDB — stored in metadata but not enforced by the database.',
    workaround:
      'The platform stores the relationship in metadata. Application-layer enforcement is deferred.',
  },
  ddlTransactions: {
    supported: false,
    reason: 'MongoDB does not support DDL transactions.',
  },
  transactions: {
    supported: 'partial',
    reason:
      'Single-document transactions are atomic. Multi-document transactions require a replica set.',
    workaround: 'Enable a replica set to use multi-document transactions.',
  },
  atomicRollback: {
    supported: false,
    reason:
      'MongoDB migrations apply best-effort rollback; full atomicity requires a replica set and multi-document sessions.',
  },
  onlineIndexCreation: { supported: true },
  rowLevelSecurityOnApi: {
    supported: false,
    reason: 'MongoDB has no native RLS. The API applies application-layer owner checks only.',
  },
  foreignKeyFiltering: {
    supported: 'partial',
    reason: 'MongoDB has no JOIN. Client code must fetch related collections separately.',
    workaround: 'Use the lookup aggregation pipeline or fetch related collections client-side.',
  },
  bulkOperationsAtomic: {
    supported: 'partial',
    reason:
      'Bulk operations are atomic per document. Multi-document atomicity requires a replica set.',
    workaround: 'Enable a replica set and multi-document sessions for full bulk atomicity.',
  },
  jsonColumnFiltering: { supported: true },
};

export const CAPABILITIES: Record<DatabaseDriver, CapabilityMatrix> = {
  postgres: POSTGRES,
  mssql: MSSQL,
  mongo: MONGO,
};

/**
 * Returns the capability status for a given feature on the given database driver.
 * Returns `{ supported: true }` if the feature key is not found (fail-open for new features).
 */
export function getCapability(
  driver: DatabaseDriver,
  feature: keyof CapabilityMatrix,
): CapabilityStatus {
  return CAPABILITIES[driver][feature];
}
