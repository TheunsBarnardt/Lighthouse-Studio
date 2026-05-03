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
import type { ClientSession, Db, Filter } from 'mongodb';

import {
  GENESIS_HASH,
  AuditError as AuditErrorClass,
  computeAuditHash,
  recomputeAuditHash,
} from '@platform/ports-audit';
import { err, ok, type Result } from 'neverthrow';
import { randomBytes, randomUUID } from 'node:crypto';

// null workspace_id is stored as the literal null in MongoDB documents.
// The chain state uses null as the key for the installation chain.

interface AuditLogDoc {
  id: string;
  sequence: number;
  workspace_id: string | null;
  event_type: string;
  occurred_at: Date;
  actor_kind: string;
  actor_id: string | null;
  actor_identity_provider: string | null;
  actor_email_snapshot: string | null;
  resource_type: string;
  resource_id: string;
  action: string;
  outcome: string;
  reason: string | null;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  correlation_id: string;
  prev_hash: string;
  hash: string;
}

interface ChainStateDoc {
  workspace_id: string | null;
  last_sequence: number;
  last_hash: string;
  initialized_at: Date;
  initialization_seed: string;
}

function docToEntry(doc: AuditLogDoc): AuditEntry {
  const base: AuditEntryInput = {
    eventType: doc.event_type,
    ...(doc.workspace_id != null ? { workspaceId: doc.workspace_id } : {}),
    actor: {
      kind: doc.actor_kind as AuditEntry['actor']['kind'],
      id: doc.actor_id,
      ...(doc.actor_identity_provider ? { identityProvider: doc.actor_identity_provider } : {}),
      ...(doc.actor_email_snapshot ? { email: doc.actor_email_snapshot } : {}),
    },
    resource: { type: doc.resource_type, id: doc.resource_id },
    action: doc.action,
    outcome: doc.outcome as AuditEntry['outcome'],
    ...(doc.reason ? { reason: doc.reason } : {}),
    metadata: doc.metadata as NonNullable<AuditEntry['metadata']>,
    ...(doc.ip_address ? { ipAddress: doc.ip_address } : {}),
    ...(doc.user_agent ? { userAgent: doc.user_agent } : {}),
    correlationId: doc.correlation_id,
  };
  return {
    ...base,
    id: doc.id,
    sequence: doc.sequence,
    occurredAt: doc.occurred_at,
    prevHash: doc.prev_hash,
    hash: doc.hash,
  };
}

// ── Adapter ───────────────────────────────────────────────────────────────────

export class MongoAuditPort implements AuditPort {
  private readonly auditLog;
  private readonly chainState;

  constructor(private readonly db: Db) {
    this.auditLog = db.collection<AuditLogDoc>('audit_log');
    this.chainState = db.collection<ChainStateDoc>('audit_chain_state');
  }

  async write(entry: AuditEntryInput): Promise<Result<AuditEntry, AuditError>> {
    const client = this.db.client;
    const session = client.startSession();
    try {
      let result: Result<AuditEntry, AuditError> = err(
        new AuditErrorClass('WRITE_FAILED', 'Transaction did not complete'),
      );
      await session.withTransaction(async () => {
        result = await this._writeOne(session, entry);
        if (result.isErr()) throw result.error;
      });
      return result;
    } catch (cause) {
      if (cause instanceof AuditErrorClass) return err(cause);
      return err(new AuditErrorClass('WRITE_FAILED', 'Failed to write audit entry', cause));
    } finally {
      await session.endSession();
    }
  }

  async writeBatch(entries: AuditEntryInput[]): Promise<Result<AuditEntry[], AuditError>> {
    if (entries.length === 0) return ok([]);
    const client = this.db.client;
    const session = client.startSession();
    try {
      const results: AuditEntry[] = [];
      await session.withTransaction(async () => {
        for (const entry of entries) {
          const r = await this._writeOne(session, entry);
          if (r.isErr()) throw r.error;
          results.push(r.value);
        }
      });
      return ok(results);
    } catch (cause) {
      if (cause instanceof AuditErrorClass) return err(cause);
      return err(new AuditErrorClass('WRITE_FAILED', 'Failed to write audit batch', cause));
    } finally {
      await session.endSession();
    }
  }

  async query(
    filter: AuditFilter,
    page: AuditPage,
  ): Promise<Result<PaginatedAuditResult, AuditError>> {
    try {
      const mongoFilter = buildMongoFilter(filter);
      const [total, docs] = await Promise.all([
        this.auditLog.countDocuments(mongoFilter),
        this.auditLog
          .find(mongoFilter)
          .sort({ occurred_at: -1, sequence: -1 })
          .skip(page.offset)
          .limit(page.limit)
          .toArray(),
      ]);
      return ok({
        items: docs.map(docToEntry),
        total,
        limit: page.limit,
        offset: page.offset,
      });
    } catch (cause) {
      return err(new AuditErrorClass('QUERY_FAILED', 'Failed to query audit log', cause));
    }
  }

  async *exportStream(filter: AuditFilter, format: ExportFormat): AsyncIterable<Buffer> {
    if (format === 'csv') {
      yield Buffer.from(CSV_HEADER + '\n', 'utf8');
    }
    const mongoFilter = buildMongoFilter(filter);
    const cursor = this.auditLog.find(mongoFilter).sort({ workspace_id: 1, sequence: 1 });
    for await (const doc of cursor) {
      yield encodeEntry(docToEntry(doc), format);
    }
  }

  async verifyChain(workspaceId: string | null): Promise<Result<ChainVerification, AuditError>> {
    try {
      const filter: Filter<AuditLogDoc> = { workspace_id: workspaceId };
      const cursor = this.auditLog.find(filter).sort({ sequence: 1 });

      let expectedPrevHash = GENESIS_HASH;
      let verifiedCount = 0;

      for await (const doc of cursor) {
        const expected = recomputeAuditHash(
          doc.event_type,
          doc.workspace_id,
          doc.actor_kind,
          doc.actor_id,
          doc.resource_type,
          doc.resource_id,
          doc.action,
          doc.outcome,
          doc.correlation_id,
          doc.sequence,
          doc.occurred_at.getTime(),
          doc.prev_hash,
        );
        if (doc.hash !== expected || doc.prev_hash !== expectedPrevHash) {
          return ok({
            workspaceId,
            verifiedAt: new Date(),
            eventsVerified: verifiedCount,
            status: 'tampered',
            tamperedAt: { sequence: doc.sequence, expectedHash: expected, actualHash: doc.hash },
          });
        }
        expectedPrevHash = doc.hash;
        verifiedCount++;
      }

      return ok({
        workspaceId,
        verifiedAt: new Date(),
        eventsVerified: verifiedCount,
        status: 'intact',
      });
    } catch (cause) {
      return err(new AuditErrorClass('CHAIN_VERIFY_FAILED', 'Chain verification failed', cause));
    }
  }

  startDataSubjectExport(
    userId: string,
    _requestedByUserId: string,
  ): Promise<Result<DataSubjectExportJob, AuditError>> {
    return Promise.resolve(
      ok({ jobId: randomUUID(), userId, requestedAt: new Date(), status: 'pending' }),
    );
  }

  startErasureRequest(
    userId: string,
    _requestedByUserId: string,
    opts?: ErasureOptions,
  ): Promise<Result<ErasureJob, AuditError>> {
    const graceDays = opts?.gracePeriodDays ?? 30;
    return Promise.resolve(
      ok({
        jobId: randomUUID(),
        userId,
        requestedAt: new Date(),
        gracePeriodEndsAt: new Date(Date.now() + graceDays * 86_400_000),
        status: 'pending',
      }),
    );
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private async _writeOne(
    session: ClientSession,
    entry: AuditEntryInput,
  ): Promise<Result<AuditEntry, AuditError>> {
    const wsChainId = entry.workspaceId ?? null;
    const isInstallation = wsChainId === null;

    // Atomically increment sequence and get previous hash.
    // findOneAndUpdate with $inc is atomic within the transaction.
    const chainDoc = await this.chainState.findOneAndUpdate(
      { workspace_id: wsChainId },
      { $inc: { last_sequence: 1 } },
      { session, returnDocument: 'before', upsert: false },
    );

    let sequence: number;
    let prevHash: string;

    if (!chainDoc) {
      // First event for this workspace — initialize chain state
      const seed = randomBytes(32).toString('hex');
      await this.chainState.insertOne(
        {
          workspace_id: wsChainId,
          last_sequence: 1,
          last_hash: GENESIS_HASH,
          initialized_at: new Date(),
          initialization_seed: seed,
        },
        { session },
      );
      sequence = 1;
      prevHash = GENESIS_HASH;
    } else {
      sequence = chainDoc.last_sequence + 1;
      prevHash = chainDoc.last_hash;
    }

    const occurredAt = new Date();
    const occurredAtMs = occurredAt.getTime();
    const hash = computeAuditHash(entry, sequence, occurredAtMs, prevHash);
    const id = randomUUID();

    const doc: AuditLogDoc = {
      id,
      sequence,
      workspace_id: isInstallation ? null : (entry.workspaceId ?? null),
      event_type: entry.eventType,
      occurred_at: occurredAt,
      actor_kind: entry.actor.kind,
      actor_id: entry.actor.id,
      actor_identity_provider: entry.actor.identityProvider ?? null,
      actor_email_snapshot: entry.actor.email ?? null,
      resource_type: entry.resource.type,
      resource_id: entry.resource.id,
      action: entry.action,
      outcome: entry.outcome,
      reason: entry.reason ?? null,
      metadata: entry.metadata ?? {},
      ip_address: entry.ipAddress ?? null,
      user_agent: entry.userAgent ?? null,
      correlation_id: entry.correlationId,
      prev_hash: prevHash,
      hash,
    };

    await this.auditLog.insertOne(doc, { session });

    // Update chain state with new last_hash
    await this.chainState.updateOne(
      { workspace_id: wsChainId },
      { $set: { last_hash: hash } },
      { session },
    );

    return ok({ ...entry, id, sequence, occurredAt, prevHash, hash });
  }
}

// ── Query builder ─────────────────────────────────────────────────────────────

function buildMongoFilter(filter: AuditFilter): Filter<AuditLogDoc> {
  const mongoFilter: Filter<AuditLogDoc> = {};

  if (filter.workspaceId !== undefined) mongoFilter.workspace_id = filter.workspaceId;
  if (filter.actorId !== undefined) mongoFilter.actor_id = filter.actorId;
  if (filter.resourceType !== undefined) mongoFilter.resource_type = filter.resourceType;
  if (filter.resourceId !== undefined) mongoFilter.resource_id = filter.resourceId;
  if (filter.action !== undefined) mongoFilter.action = filter.action;
  if (filter.outcome !== undefined) mongoFilter.outcome = filter.outcome;
  if (filter.correlationId !== undefined) mongoFilter.correlation_id = filter.correlationId;

  if (filter.eventType !== undefined) {
    if (Array.isArray(filter.eventType)) {
      mongoFilter.event_type = { $in: filter.eventType };
    } else {
      mongoFilter.event_type = filter.eventType;
    }
  }

  if (filter.occurredAfter !== undefined || filter.occurredBefore !== undefined) {
    const timeFilter: { $gte?: Date; $lte?: Date } = {};
    if (filter.occurredAfter) timeFilter.$gte = filter.occurredAfter;
    if (filter.occurredBefore) timeFilter.$lte = filter.occurredBefore;
    (mongoFilter as Record<string, unknown>)['occurred_at'] = timeFilter;
  }

  return mongoFilter;
}

// ── Export formatters ─────────────────────────────────────────────────────────

const CSV_HEADER =
  '"id","event_type","workspace_id","actor_kind","actor_id","resource_type","resource_id","action","outcome","occurred_at","correlation_id"';

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
    case 'cef':
      return Buffer.from(
        `CEF:0|Platform|AuditLog|1.0|${entry.eventType}|${entry.action}|5|` +
          `cs1=${entry.workspaceId ?? ''} cs1Label=workspaceId suser=${entry.actor.id ?? ''} ` +
          `act=${entry.action} outcome=${entry.outcome} rt=${String(entry.occurredAt.getTime())}\n`,
        'utf8',
      );
    case 'leef':
      return Buffer.from(
        `LEEF:2.0|Platform|AuditLog|1.0|${entry.eventType}|` +
          `devTime=${entry.occurredAt.toISOString()}\tusrName=${entry.actor.id ?? ''}\t` +
          `action=${entry.action}\toutcome=${entry.outcome}\t` +
          `workspaceId=${entry.workspaceId ?? ''}\tcorrelationId=${entry.correlationId}\n`,
        'utf8',
      );
  }
}
