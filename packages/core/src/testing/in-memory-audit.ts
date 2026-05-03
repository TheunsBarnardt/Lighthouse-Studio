import type {
  AuditEntry,
  AuditEntryInput,
  AuditFilter,
  AuditPage,
  AuditPort,
  ChainVerification,
  DataSubjectExportJob,
  ErasureJob,
  ErasureOptions,
  ExportFormat,
  PaginatedAuditResult,
} from '@platform/ports-audit';

import { ok, type Result } from 'neverthrow';

/**
 * In-memory AuditPort for unit tests. Captures all written events
 * so tests can assert on what was emitted without a real database.
 *
 * Only `write` and `writeBatch` are meaningfully implemented; all other
 * methods return empty/stub results since unit tests don't exercise them.
 */
export function createInMemoryAudit(): AuditPort & {
  /** All events written since the adapter was created. */
  events: AuditEntryInput[];
  /** Clear the captured events between test cases. */
  reset(): void;
} {
  const events: AuditEntryInput[] = [];
  let seq = 0;

  function toEntry(input: AuditEntryInput): AuditEntry {
    seq++;
    return {
      ...input,
      id: `audit-${String(seq)}`,
      sequence: seq,
      occurredAt: new Date(),
      prevHash: '',
      hash: `hash-${String(seq)}`,
    };
  }

  return {
    events,

    reset() {
      events.length = 0;
    },

    write(entry: AuditEntryInput): Promise<Result<AuditEntry, never>> {
      events.push(entry);
      return Promise.resolve(ok(toEntry(entry)));
    },

    writeBatch(entries: AuditEntryInput[]): Promise<Result<AuditEntry[], never>> {
      events.push(...entries);
      return Promise.resolve(ok(entries.map(toEntry)));
    },

    query(_filter: AuditFilter, page: AuditPage): Promise<Result<PaginatedAuditResult, never>> {
      return Promise.resolve(ok({ items: [], total: 0, limit: page.limit, offset: page.offset }));
    },

    async *exportStream(_filter: AuditFilter, _format: ExportFormat): AsyncIterable<Buffer> {
      // no-op in test context
    },

    verifyChain(workspaceId: string | null): Promise<Result<ChainVerification, never>> {
      return Promise.resolve(
        ok({
          workspaceId,
          verifiedAt: new Date(),
          eventsVerified: 0,
          status: 'intact' as const,
        }),
      );
    },

    startDataSubjectExport(
      _userId: string,
      _requestedByUserId: string,
    ): Promise<Result<DataSubjectExportJob, never>> {
      return Promise.resolve(
        ok({
          jobId: 'test-job',
          userId: _userId,
          requestedAt: new Date(),
          status: 'pending',
          downloadUrl: null,
          expiresAt: null,
        } as unknown as DataSubjectExportJob),
      );
    },

    startErasureRequest(
      _userId: string,
      _requestedByUserId: string,
      _opts?: ErasureOptions,
    ): Promise<Result<ErasureJob, never>> {
      return Promise.resolve(
        ok({
          jobId: 'test-erasure-job',
          userId: _userId,
          requestedAt: new Date(),
          status: 'pending',
        } as unknown as ErasureJob),
      );
    },
  };
}
