import type { Result } from 'neverthrow';

import type { AuditError } from './errors.js';
import type { ColdArchiveChunk, ColdArchiveVerification } from './types.js';

/**
 * Optional cold-archive port for write-once external storage of signed audit chunks.
 * Only injected when PLATFORM_COLD_ARCHIVE_ENABLED=true.
 *
 * See ADR-0074 for rationale (opt-in, not mandatory).
 */
export interface ColdArchivePort {
  /**
   * Archive one day's audit events for a workspace.
   *
   * The implementation must:
   *   1. Query all events for the given workspace/date
   *   2. Serialize to JSON Lines, gzip-compress
   *   3. Compute SHA-256 of the compressed bytes
   *   4. Sign the hash with the installation private key
   *   5. Upload to object storage with object lock
   *   6. Return the chunk metadata (stored in audit_chain_state)
   */
  archiveDay(
    workspaceId: string | null,
    date: string,
  ): Promise<Result<ColdArchiveChunk, AuditError>>;

  /**
   * Verify a previously archived chunk by re-downloading and checking the signature.
   */
  verifyChunk(objectKey: string): Promise<Result<ColdArchiveVerification, AuditError>>;

  /**
   * List all archived chunks for a workspace in descending date order.
   */
  listChunks(
    workspaceId: string | null,
    limit?: number,
  ): Promise<Result<ColdArchiveChunk[], AuditError>>;
}
