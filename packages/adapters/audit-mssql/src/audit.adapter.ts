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
import type sql from 'mssql';

import {
  GENESIS_HASH,
  AuditError as AuditErrorClass,
  computeAuditHash,
  recomputeAuditHash,
} from '@platform/ports-audit';
import { err, ok, type Result } from 'neverthrow';
import { randomUUID } from 'node:crypto';

const INSTALLATION_CHAIN_ID = '00000000-0000-0000-0000-000000000000';

function chainId(workspaceId: string | null | undefined): string {
  return workspaceId ?? INSTALLATION_CHAIN_ID;
}

// ── Row mappers ───────────────────────────────────────────────────────────────

interface AuditLogRow {
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
  metadata: string;
  ip_address: string | null;
  user_agent: string | null;
  correlation_id: string;
  prev_hash: string;
  hash: string;
}

function rowToEntry(row: AuditLogRow): AuditEntry {
  const base: AuditEntryInput = {
    eventType: row.event_type,
    ...(row.workspace_id != null ? { workspaceId: row.workspace_id } : {}),
    actor: {
      kind: row.actor_kind as AuditEntry['actor']['kind'],
      id: row.actor_id,
      ...(row.actor_identity_provider ? { identityProvider: row.actor_identity_provider } : {}),
      ...(row.actor_email_snapshot ? { email: row.actor_email_snapshot } : {}),
    },
    resource: { type: row.resource_type, id: row.resource_id },
    action: row.action,
    outcome: row.outcome as AuditEntry['outcome'],
    ...(row.reason ? { reason: row.reason } : {}),
    metadata: JSON.parse(row.metadata) as NonNullable<AuditEntry['metadata']>,
    ...(row.ip_address ? { ipAddress: row.ip_address } : {}),
    ...(row.user_agent ? { userAgent: row.user_agent } : {}),
    correlationId: row.correlation_id,
  };
  return {
    ...base,
    id: row.id,
    sequence: row.sequence,
    occurredAt: row.occurred_at,
    prevHash: row.prev_hash,
    hash: row.hash,
  };
}

// ── Adapter ───────────────────────────────────────────────────────────────────

export class MssqlAuditPort implements AuditPort {
  constructor(private readonly pool: sql.ConnectionPool) {}

  async write(entry: AuditEntryInput): Promise<Result<AuditEntry, AuditError>> {
    const transaction = this.pool.transaction();
    try {
      await transaction.begin();
      const result = await this._writeOne(transaction, entry);
      if (result.isErr()) {
        await transaction.rollback();
        return result;
      }
      await transaction.commit();
      return result;
    } catch (cause) {
      await transaction.rollback().catch(() => undefined);
      return err(new AuditErrorClass('WRITE_FAILED', 'Failed to write audit entry', cause));
    }
  }

  async writeBatch(entries: AuditEntryInput[]): Promise<Result<AuditEntry[], AuditError>> {
    if (entries.length === 0) return ok([]);
    const transaction = this.pool.transaction();
    try {
      await transaction.begin();
      const results: AuditEntry[] = [];
      for (const entry of entries) {
        const result = await this._writeOne(transaction, entry);
        if (result.isErr()) {
          await transaction.rollback();
          return err(result.error);
        }
        results.push(result.value);
      }
      await transaction.commit();
      return ok(results);
    } catch (cause) {
      await transaction.rollback().catch(() => undefined);
      return err(new AuditErrorClass('WRITE_FAILED', 'Failed to write audit batch', cause));
    }
  }

  async query(
    filter: AuditFilter,
    page: AuditPage,
  ): Promise<Result<PaginatedAuditResult, AuditError>> {
    try {
      const request = this.pool.request();
      const { whereClause } = buildWhereClause(filter, request);

      const countSql = `SELECT COUNT(*) AS total FROM [dbo].[audit_log] ${whereClause}`;
      const dataSql = `
        SELECT * FROM [dbo].[audit_log]
        ${whereClause}
        ORDER BY [occurred_at] DESC, [sequence] DESC
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
      `;
      request.input('offset', page.offset);
      request.input('limit', page.limit);

      const countResult = await request.query<{ total: number }>(countSql);
      const dataResult = await request.query<AuditLogRow>(dataSql);

      return ok({
        items: dataResult.recordset.map(rowToEntry),
        total: countResult.recordset[0]?.total ?? 0,
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
    const request = this.pool.request();
    const { whereClause } = buildWhereClause(filter, request);
    const sql = `
      SELECT * FROM [dbo].[audit_log]
      ${whereClause}
      ORDER BY [workspace_id], [sequence] ASC
    `;
    const result = await request.query<AuditLogRow>(sql);
    for (const row of result.recordset) {
      yield encodeEntry(rowToEntry(row), format);
    }
  }

  async verifyChain(workspaceId: string | null): Promise<Result<ChainVerification, AuditError>> {
    try {
      const request = this.pool.request();
      let sql: string;
      if (workspaceId === null) {
        sql = `SELECT * FROM [dbo].[audit_log] WHERE [workspace_id] IS NULL ORDER BY [sequence] ASC`;
      } else {
        request.input('wsId', workspaceId);
        sql = `SELECT * FROM [dbo].[audit_log] WHERE [workspace_id] = @wsId ORDER BY [sequence] ASC`;
      }
      const result = await request.query<AuditLogRow>(sql);
      const rows = result.recordset;

      let expectedPrevHash = GENESIS_HASH;
      for (const row of rows) {
        const expected = recomputeAuditHash(
          row.event_type,
          row.workspace_id,
          row.actor_kind,
          row.actor_id,
          row.resource_type,
          row.resource_id,
          row.action,
          row.outcome,
          row.correlation_id,
          row.sequence,
          row.occurred_at.getTime(),
          row.prev_hash,
        );
        if (row.hash !== expected || row.prev_hash !== expectedPrevHash) {
          return ok({
            workspaceId,
            verifiedAt: new Date(),
            eventsVerified: rows.indexOf(row),
            status: 'tampered',
            tamperedAt: { sequence: row.sequence, expectedHash: expected, actualHash: row.hash },
          });
        }
        expectedPrevHash = row.hash;
      }

      return ok({
        workspaceId,
        verifiedAt: new Date(),
        eventsVerified: rows.length,
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
    transaction: sql.Transaction,
    entry: AuditEntryInput,
  ): Promise<Result<AuditEntry, AuditError>> {
    const wsChainId = chainId(entry.workspaceId);
    const isInstallation = entry.workspaceId === undefined;
    const request = transaction.request();

    // Atomically increment sequence and read last_hash
    request.input('wsChainId', wsChainId);
    const chainResult = await request.query<{ last_sequence: number; last_hash: string }>(`
      UPDATE [dbo].[audit_chain_state]
      SET [last_sequence] = [last_sequence] + 1
      OUTPUT INSERTED.[last_sequence], DELETED.[last_hash]
      WHERE [workspace_id] = @wsChainId
    `);

    let sequence: number;
    let prevHash: string;

    if (chainResult.recordset.length === 0) {
      // First event for this workspace
      const seed = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
      const insertRequest = transaction.request();
      insertRequest.input('wsChainId2', wsChainId);
      insertRequest.input('seed', seed.slice(0, 64));
      await insertRequest.query(`
        INSERT INTO [dbo].[audit_chain_state]
          ([workspace_id], [last_sequence], [last_hash], [initialization_seed])
        VALUES (@wsChainId2, 1, '${GENESIS_HASH}', @seed)
      `);
      sequence = 1;
      prevHash = GENESIS_HASH;
    } else {
      const chainRow = chainResult.recordset[0] as { last_sequence: number; last_hash: string };
      sequence = chainRow.last_sequence;
      prevHash = chainRow.last_hash;
    }

    const occurredAt = new Date();
    const occurredAtMs = occurredAt.getTime();
    const hash = computeAuditHash(entry, sequence, occurredAtMs, prevHash);
    const id = randomUUID();

    const insertRequest = transaction.request();
    insertRequest.input('id', id);
    insertRequest.input('sequence', sequence);
    insertRequest.input('workspaceId', isInstallation ? null : entry.workspaceId);
    insertRequest.input('eventType', entry.eventType);
    insertRequest.input('occurredAt', occurredAt);
    insertRequest.input('actorKind', entry.actor.kind);
    insertRequest.input('actorId', entry.actor.id ?? null);
    insertRequest.input('actorProvider', entry.actor.identityProvider ?? null);
    insertRequest.input('actorEmail', entry.actor.email ?? null);
    insertRequest.input('resourceType', entry.resource.type);
    insertRequest.input('resourceId', entry.resource.id);
    insertRequest.input('action', entry.action);
    insertRequest.input('outcome', entry.outcome);
    insertRequest.input('reason', entry.reason ?? null);
    insertRequest.input('metadata', JSON.stringify(entry.metadata ?? {}));
    insertRequest.input('ipAddress', entry.ipAddress ?? null);
    insertRequest.input('userAgent', entry.userAgent ?? null);
    insertRequest.input('correlationId', entry.correlationId);
    insertRequest.input('prevHash', prevHash);
    insertRequest.input('hash', hash);

    await insertRequest.query(`
      INSERT INTO [dbo].[audit_log] (
        [id], [sequence], [workspace_id], [event_type], [occurred_at],
        [actor_kind], [actor_id], [actor_identity_provider], [actor_email_snapshot],
        [resource_type], [resource_id], [action], [outcome], [reason],
        [metadata], [ip_address], [user_agent], [correlation_id], [prev_hash], [hash]
      ) VALUES (
        @id, @sequence, @workspaceId, @eventType, @occurredAt,
        @actorKind, @actorId, @actorProvider, @actorEmail,
        @resourceType, @resourceId, @action, @outcome, @reason,
        @metadata, @ipAddress, @userAgent, @correlationId, @prevHash, @hash
      )
    `);

    // Update chain state with the new last_hash
    const updateRequest = transaction.request();
    updateRequest.input('hash2', hash);
    updateRequest.input('wsChainId3', wsChainId);
    await updateRequest.query(
      `UPDATE [dbo].[audit_chain_state] SET [last_hash] = @hash2 WHERE [workspace_id] = @wsChainId3`,
    );

    return ok({ ...entry, id, sequence, occurredAt, prevHash, hash });
  }
}

// ── Query builder ─────────────────────────────────────────────────────────────

function buildWhereClause(filter: AuditFilter, request: sql.Request): { whereClause: string } {
  const conditions: string[] = [];
  let pIdx = 0;

  const addParam = (prefix: string, value: unknown): string => {
    const name = `${prefix}${pIdx.toString()}`;
    pIdx++;
    request.input(name, value);
    return `@${name}`;
  };

  if (filter.workspaceId !== undefined) {
    conditions.push(`[workspace_id] = ${addParam('ws', filter.workspaceId)}`);
  }

  if (filter.eventType !== undefined) {
    if (Array.isArray(filter.eventType)) {
      const inParams = filter.eventType.map((et, i) => {
        const name = `et${pIdx.toString()}_${i.toString()}`;
        pIdx++;
        request.input(name, et);
        return `@${name}`;
      });
      conditions.push(`[event_type] IN (${inParams.join(', ')})`);
    } else {
      conditions.push(`[event_type] = ${addParam('et', filter.eventType)}`);
    }
  }

  if (filter.actorId !== undefined) {
    conditions.push(`[actor_id] = ${addParam('ai', filter.actorId)}`);
  }

  if (filter.resourceType !== undefined) {
    conditions.push(`[resource_type] = ${addParam('rt', filter.resourceType)}`);
  }

  if (filter.resourceId !== undefined) {
    conditions.push(`[resource_id] = ${addParam('ri', filter.resourceId)}`);
  }

  if (filter.action !== undefined) {
    conditions.push(`[action] = ${addParam('ac', filter.action)}`);
  }

  if (filter.outcome !== undefined) {
    conditions.push(`[outcome] = ${addParam('oc', filter.outcome)}`);
  }

  if (filter.occurredAfter !== undefined) {
    conditions.push(`[occurred_at] >= ${addParam('oa', filter.occurredAfter)}`);
  }

  if (filter.occurredBefore !== undefined) {
    conditions.push(`[occurred_at] <= ${addParam('ob', filter.occurredBefore)}`);
  }

  if (filter.correlationId !== undefined) {
    conditions.push(`[correlation_id] = ${addParam('ci', filter.correlationId)}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return { whereClause };
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
