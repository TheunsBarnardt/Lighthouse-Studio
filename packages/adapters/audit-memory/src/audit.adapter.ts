import type {
  AuditEntry,
  AuditEntryInput,
  AuditError,
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
import type { Result } from 'neverthrow';

import { GENESIS_HASH, computeAuditHash, recomputeAuditHash } from '@platform/ports-audit';
import { ok } from 'neverthrow';
import { randomUUID } from 'node:crypto';

// ── Per-workspace chain state ─────────────────────────────────────────────────

interface ChainState {
  lastSequence: number;
  lastHash: string;
}

// ── Adapter ───────────────────────────────────────────────────────────────────

export class InMemoryAuditPort implements AuditPort {
  private readonly log: AuditEntry[] = [];
  private readonly chains = new Map<string, ChainState>();

  // chain key: workspaceId or '__installation__' for null workspace
  private chainKey(workspaceId: string | null | undefined): string {
    return workspaceId ?? '__installation__';
  }

  private nextChainEntry(workspaceId: string | null | undefined): {
    sequence: number;
    prevHash: string;
  } {
    const key = this.chainKey(workspaceId);
    const state = this.chains.get(key);
    if (!state) {
      return { sequence: 1, prevHash: GENESIS_HASH };
    }
    return { sequence: state.lastSequence + 1, prevHash: state.lastHash };
  }

  private advanceChain(
    workspaceId: string | null | undefined,
    sequence: number,
    hash: string,
  ): void {
    this.chains.set(this.chainKey(workspaceId), { lastSequence: sequence, lastHash: hash });
  }

  private writeOne(entry: AuditEntryInput): AuditEntry {
    const { sequence, prevHash } = this.nextChainEntry(entry.workspaceId);
    const occurredAt = new Date();
    const occurredAtMs = occurredAt.getTime();
    const hash = computeAuditHash(entry, sequence, occurredAtMs, prevHash);
    const persisted: AuditEntry = {
      ...entry,
      id: randomUUID(),
      sequence,
      occurredAt,
      prevHash,
      hash,
    };
    this.log.push(persisted);
    this.advanceChain(entry.workspaceId, sequence, hash);
    return persisted;
  }

  write(entry: AuditEntryInput): Promise<Result<AuditEntry, AuditError>> {
    return Promise.resolve(ok(this.writeOne(entry)));
  }

  writeBatch(entries: AuditEntryInput[]): Promise<Result<AuditEntry[], AuditError>> {
    const results = entries.map((e) => this.writeOne(e));
    return Promise.resolve(ok(results));
  }

  query(filter: AuditFilter, page: AuditPage): Promise<Result<PaginatedAuditResult, AuditError>> {
    let items = this.log.filter((e) => {
      if (filter.workspaceId !== undefined && e.workspaceId !== filter.workspaceId) return false;
      if (filter.actorId !== undefined && e.actor.id !== filter.actorId) return false;
      if (filter.action !== undefined && e.action !== filter.action) return false;
      if (filter.resourceType !== undefined && e.resource.type !== filter.resourceType)
        return false;
      if (filter.resourceId !== undefined && e.resource.id !== filter.resourceId) return false;
      if (filter.outcome !== undefined && e.outcome !== filter.outcome) return false;
      if (filter.correlationId !== undefined && e.correlationId !== filter.correlationId)
        return false;
      if (filter.occurredAfter !== undefined && e.occurredAt < filter.occurredAfter) return false;
      if (filter.occurredBefore !== undefined && e.occurredAt > filter.occurredBefore) return false;
      if (filter.eventType !== undefined) {
        const match = Array.isArray(filter.eventType)
          ? filter.eventType.includes(e.eventType)
          : e.eventType === filter.eventType;
        if (!match) return false;
      }
      return true;
    });
    const total = items.length;
    items = items.slice(page.offset, page.offset + page.limit);
    return Promise.resolve(
      ok({
        items: items.map((e) => ({ ...e })),
        total,
        limit: page.limit,
        offset: page.offset,
      }),
    );
  }

  async *exportStream(filter: AuditFilter, format: ExportFormat): AsyncIterable<Buffer> {
    const result = await this.query(filter, { limit: 10_000, offset: 0 });
    const entries = result._unsafeUnwrap().items;
    for (const entry of entries) {
      yield encodeEntry(entry, format);
    }
  }

  verifyChain(workspaceId: string | null): Promise<Result<ChainVerification, AuditError>> {
    const key = this.chainKey(workspaceId);
    const entries = this.log
      .filter((e) => this.chainKey(e.workspaceId) === key)
      .sort((a, b) => a.sequence - b.sequence);

    let expectedPrevHash = GENESIS_HASH;
    for (const entry of entries) {
      const expected = recomputeAuditHash(
        entry.eventType,
        entry.workspaceId ?? null,
        entry.actor.kind,
        entry.actor.id,
        entry.resource.type,
        entry.resource.id,
        entry.action,
        entry.outcome,
        entry.correlationId,
        entry.sequence,
        entry.occurredAt.getTime(),
        entry.prevHash,
      );
      if (entry.hash !== expected || entry.prevHash !== expectedPrevHash) {
        return Promise.resolve(
          ok({
            workspaceId,
            verifiedAt: new Date(),
            eventsVerified: entries.indexOf(entry),
            status: 'tampered' as const,
            tamperedAt: {
              sequence: entry.sequence,
              expectedHash: expected,
              actualHash: entry.hash,
            },
          }),
        );
      }
      expectedPrevHash = entry.hash;
    }

    return Promise.resolve(
      ok({
        workspaceId,
        verifiedAt: new Date(),
        eventsVerified: entries.length,
        status: 'intact' as const,
      }),
    );
  }

  startDataSubjectExport(
    userId: string,
    _requestedByUserId: string,
  ): Promise<Result<DataSubjectExportJob, AuditError>> {
    const job: DataSubjectExportJob = {
      jobId: randomUUID(),
      userId,
      requestedAt: new Date(),
      status: 'pending',
    };
    // In-memory adapter does not actually process the export; for testing only.
    return Promise.resolve(ok(job));
  }

  startErasureRequest(
    userId: string,
    _requestedByUserId: string,
    opts?: ErasureOptions,
  ): Promise<Result<ErasureJob, AuditError>> {
    const graceDays = opts?.gracePeriodDays ?? 30;
    const gracePeriodEndsAt = new Date(Date.now() + graceDays * 86_400_000);
    const job: ErasureJob = {
      jobId: randomUUID(),
      userId,
      requestedAt: new Date(),
      gracePeriodEndsAt,
      status: 'pending',
    };
    return Promise.resolve(ok(job));
  }
}

// ── Format helpers ────────────────────────────────────────────────────────────

function encodeEntry(entry: AuditEntry, format: ExportFormat): Buffer {
  switch (format) {
    case 'jsonl':
      return Buffer.from(JSON.stringify(entry) + '\n', 'utf8');
    case 'csv': {
      const row = [
        entry.id,
        entry.eventType,
        entry.workspaceId ?? '',
        entry.actor.kind,
        entry.actor.id ?? '',
        entry.resource.type,
        entry.resource.id,
        entry.action,
        entry.outcome,
        entry.occurredAt.toISOString(),
        entry.correlationId,
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(',');
      return Buffer.from(row + '\n', 'utf8');
    }
    case 'cef': {
      // Common Event Format
      const cef =
        `CEF:0|Platform|AuditLog|1.0|${entry.eventType}|${entry.action}|5|` +
        `cs1=${entry.workspaceId ?? ''} cs1Label=workspaceId ` +
        `suser=${entry.actor.id ?? ''} ` +
        `act=${entry.action} ` +
        `outcome=${entry.outcome} ` +
        `rt=${String(entry.occurredAt.getTime())}`;
      return Buffer.from(cef + '\n', 'utf8');
    }
    case 'leef': {
      // Log Event Extended Format
      const leef =
        `LEEF:2.0|Platform|AuditLog|1.0|${entry.eventType}|` +
        `devTime=${entry.occurredAt.toISOString()}\t` +
        `usrName=${entry.actor.id ?? ''}\t` +
        `action=${entry.action}\t` +
        `outcome=${entry.outcome}\t` +
        `workspaceId=${entry.workspaceId ?? ''}\t` +
        `correlationId=${entry.correlationId}`;
      return Buffer.from(leef + '\n', 'utf8');
    }
  }
}
