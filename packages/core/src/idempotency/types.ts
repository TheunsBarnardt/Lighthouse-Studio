/**
 * An idempotency record stores the result of a mutating operation keyed by
 * the hash of (operation + idempotency key). The hash column has a unique
 * constraint; duplicate inserts are caught and the stored result returned.
 *
 * Table: idempotency_records
 * Unique index: (key_hash, operation)
 */
export interface IdempotencyRecord {
  id: string;
  version: number;
  /** Workspace scope; null for installation-scoped operations. */
  workspaceId: string | null;
  /** Stable name identifying the operation (e.g. 'WorkspaceService.create'). */
  operation: string;
  /** SHA-256 of "<operation>:<idempotencyKey>". */
  keyHash: string;
  /** JSON-serialised successful Result value. */
  resultJson: string;
  /** When this record expires and may be garbage-collected. */
  expiresAt: Date;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
}

/** Default idempotency window: 24 hours. Override per-operation via opts. */
export const DEFAULT_IDEMPOTENCY_WINDOW_MS = 24 * 60 * 60 * 1000;
