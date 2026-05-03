import type { Result } from 'neverthrow';

import type { AuditError } from './errors.js';
import type {
  AuditEntry,
  AuditEntryInput,
  AuditFilter,
  AuditPage,
  ChainVerification,
  DataSubjectExportJob,
  ErasureJob,
  ErasureOptions,
  ExportFormat,
  PaginatedAuditResult,
} from './types.js';

export interface AuditPort {
  /**
   * Write a single audit event. The adapter computes the hash chain entry and persists.
   * The returned AuditEntry includes the assigned id, sequence, hashes, and occurredAt.
   */
  write(entry: AuditEntryInput): Promise<Result<AuditEntry, AuditError>>;

  /**
   * Write a batch of events. More efficient under high event rates.
   * All entries must belong to the same workspace.
   */
  writeBatch(entries: AuditEntryInput[]): Promise<Result<AuditEntry[], AuditError>>;

  /**
   * Query audit events. Workspace-scoped by default; installation-scoped queries
   * require the caller to hold the installation_auditor role (enforced at the service layer).
   */
  query(filter: AuditFilter, page: AuditPage): Promise<Result<PaginatedAuditResult, AuditError>>;

  /**
   * Stream audit events for export. Returns an AsyncIterable of buffers for
   * memory-efficient handling of large exports.
   */
  exportStream(filter: AuditFilter, format: ExportFormat): AsyncIterable<Buffer>;

  /**
   * Verify the hash chain integrity for a workspace (or the installation chain when
   * workspaceId is null). Re-reads all events in order and recomputes hashes.
   * This is expensive (linear in chain length); run quarterly, not on every request.
   */
  verifyChain(workspaceId: string | null): Promise<Result<ChainVerification, AuditError>>;

  /**
   * Begin a GDPR Article 15 data subject access request.
   * Assembles all data for a user and delivers a time-limited download archive.
   */
  startDataSubjectExport(
    userId: string,
    requestedByUserId: string,
  ): Promise<Result<DataSubjectExportJob, AuditError>>;

  /**
   * Begin a GDPR Article 17 erasure request.
   * Soft-deletes the user immediately; hard-deletes after the grace period.
   */
  startErasureRequest(
    userId: string,
    requestedByUserId: string,
    opts?: ErasureOptions,
  ): Promise<Result<ErasureJob, AuditError>>;
}
