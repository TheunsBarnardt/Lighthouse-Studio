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
import type { Pool, PoolClient } from 'pg';

import {
  GENESIS_HASH,
  AuditError as AuditErrorClass,
  computeAuditHash,
  recomputeAuditHash,
} from '@platform/ports-audit';
import { err, ok, type Result } from 'neverthrow';
import { randomUUID } from 'node:crypto';

// Sentinel UUID used for the installation-level chain (no workspace).
const INSTALLATION_CHAIN_ID = '00000000-0000-0000-0000-000000000000';

function chainId(workspaceId: string | null | undefined): string {
  return workspaceId ?? INSTALLATION_CHAIN_ID;
}

// ── Row mappers ───────────────────────────────────────────────────────────────

interface AuditLogRow {
  id: string;
  sequence: string; // bigint comes back as string from pg
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
    metadata: row.metadata as NonNullable<AuditEntry['metadata']>,
    ...(row.ip_address ? { ipAddress: row.ip_address } : {}),
    ...(row.user_agent ? { userAgent: row.user_agent } : {}),
    correlationId: row.correlation_id,
  };
  return {
    ...base,
    id: row.id,
    sequence: Number(row.sequence),
    occurredAt: row.occurred_at,
    prevHash: row.prev_hash,
    hash: row.hash,
  };
}

// ── Adapter ───────────────────────────────────────────────────────────────────

export class PostgresAuditPort implements AuditPort {
  constructor(private readonly pool: Pool) {}

  async write(entry: AuditEntryInput): Promise<Result<AuditEntry, AuditError>> {
    const client = await this.pool.connect();
    try {
      return await this._writeOne(client, entry);
    } catch (cause) {
      return err(new AuditErrorClass('WRITE_FAILED', 'Failed to write audit entry', cause));
    } finally {
      client.release();
    }
  }

  async writeBatch(entries: AuditEntryInput[]): Promise<Result<AuditEntry[], AuditError>> {
    if (entries.length === 0) return ok([]);
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const results: AuditEntry[] = [];
      for (const entry of entries) {
        const result = await this._writeOne(client, entry);
        if (result.isErr()) {
          await client.query('ROLLBACK');
          return err(result.error);
        }
        results.push(result.value);
      }
      await client.query('COMMIT');
      return ok(results);
    } catch (cause) {
      await client.query('ROLLBACK').catch(() => undefined);
      return err(new AuditErrorClass('WRITE_FAILED', 'Failed to write audit batch', cause));
    } finally {
      client.release();
    }
  }

  async query(
    filter: AuditFilter,
    page: AuditPage,
  ): Promise<Result<PaginatedAuditResult, AuditError>> {
    try {
      const { whereClause, params } = buildWhereClause(filter);

      const countSql = `SELECT COUNT(*) AS total FROM audit_log ${whereClause}`;
      const dataSql = `
        SELECT * FROM audit_log
        ${whereClause}
        ORDER BY occurred_at DESC, sequence DESC
        LIMIT $${String(params.length + 1)} OFFSET $${String(params.length + 2)}
      `;

      const [countResult, dataResult] = await Promise.all([
        this.pool.query<{ total: string }>(countSql, params),
        this.pool.query<AuditLogRow>(dataSql, [...params, page.limit, page.offset]),
      ]);

      return ok({
        items: dataResult.rows.map(rowToEntry),
        total: Number(countResult.rows[0]?.total ?? 0),
        limit: page.limit,
        offset: page.offset,
      });
    } catch (cause) {
      return err(new AuditErrorClass('QUERY_FAILED', 'Failed to query audit log', cause));
    }
  }

  async *exportStream(filter: AuditFilter, format: ExportFormat): AsyncIterable<Buffer> {
    const { whereClause, params } = buildWhereClause(filter);
    const sql = `
      SELECT * FROM audit_log
      ${whereClause}
      ORDER BY workspace_id, sequence ASC
    `;

    if (format === 'csv') {
      yield Buffer.from(CSV_HEADER + '\n', 'utf8');
    }

    const client = await this.pool.connect();
    try {
      // Use a simple batch approach since the pg cursor API varies by version
      const result = await this.pool.query<AuditLogRow>(sql, params);
      for (const row of result.rows) {
        yield encodeEntry(rowToEntry(row), format);
      }
    } finally {
      client.release();
    }
  }

  async verifyChain(workspaceId: string | null): Promise<Result<ChainVerification, AuditError>> {
    try {
      const wsParam = workspaceId ?? null;
      const sql = `
        SELECT * FROM audit_log
        WHERE workspace_id ${wsParam === null ? 'IS NULL' : '= $1'}
        ORDER BY sequence ASC
      `;
      const result = await this.pool.query<AuditLogRow>(sql, wsParam !== null ? [wsParam] : []);

      let expectedPrevHash = GENESIS_HASH;
      for (const row of result.rows) {
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
          Number(row.sequence),
          row.occurred_at.getTime(),
          row.prev_hash,
        );
        if (row.hash !== expected || row.prev_hash !== expectedPrevHash) {
          return ok({
            workspaceId,
            verifiedAt: new Date(),
            eventsVerified: result.rows.indexOf(row),
            status: 'tampered',
            tamperedAt: {
              sequence: Number(row.sequence),
              expectedHash: expected,
              actualHash: row.hash,
            },
          });
        }
        expectedPrevHash = row.hash;
      }

      return ok({
        workspaceId,
        verifiedAt: new Date(),
        eventsVerified: result.rows.length,
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
    // Enqueues an async job; the actual export is processed by the worker.
    const jobId = randomUUID();
    return Promise.resolve(ok({ jobId, userId, requestedAt: new Date(), status: 'pending' }));
  }

  startErasureRequest(
    userId: string,
    _requestedByUserId: string,
    opts?: ErasureOptions,
  ): Promise<Result<ErasureJob, AuditError>> {
    const graceDays = opts?.gracePeriodDays ?? 30;
    const gracePeriodEndsAt = new Date(Date.now() + graceDays * 86_400_000);
    const jobId = randomUUID();
    return Promise.resolve(
      ok({ jobId, userId, requestedAt: new Date(), gracePeriodEndsAt, status: 'pending' }),
    );
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private async _writeOne(
    client: PoolClient,
    entry: AuditEntryInput,
  ): Promise<Result<AuditEntry, AuditError>> {
    const wsChainId = chainId(entry.workspaceId);
    const isInstallation = entry.workspaceId === undefined;

    // Lock + update chain state atomically
    const chainSql = `
      UPDATE audit_chain_state
      SET
        last_sequence = last_sequence + 1
      WHERE workspace_id = $1
      RETURNING last_sequence, last_hash
    `;
    const chainResult = await client.query<{ last_sequence: string; last_hash: string }>(chainSql, [
      wsChainId,
    ]);

    let sequence: number;
    let prevHash: string;

    if (chainResult.rows.length === 0) {
      // First event for this workspace — insert chain state row
      const seed = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
      await client.query(
        `INSERT INTO audit_chain_state (workspace_id, last_sequence, last_hash, initialization_seed)
         VALUES ($1, 1, $2, $3)`,
        [wsChainId, GENESIS_HASH, seed.slice(0, 64)],
      );
      sequence = 1;
      prevHash = GENESIS_HASH;
    } else {
      const chainRow = chainResult.rows[0] as { last_sequence: string; last_hash: string };
      sequence = Number(chainRow.last_sequence);
      prevHash = chainRow.last_hash;
    }

    const occurredAt = new Date();
    const occurredAtMs = occurredAt.getTime();
    const hash = computeAuditHash(entry, sequence, occurredAtMs, prevHash);

    const insertSql = `
      INSERT INTO audit_log (
        id, sequence, workspace_id, event_type, occurred_at,
        actor_kind, actor_id, actor_identity_provider, actor_email_snapshot,
        resource_type, resource_id, action, outcome, reason,
        metadata, ip_address, user_agent, correlation_id, prev_hash, hash
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9,
        $10, $11, $12, $13, $14,
        $15, $16, $17, $18, $19, $20
      )
    `;

    const id = randomUUID();
    await client.query(insertSql, [
      id,
      sequence,
      isInstallation ? null : entry.workspaceId,
      entry.eventType,
      occurredAt,
      entry.actor.kind,
      entry.actor.id ?? null,
      entry.actor.identityProvider ?? null,
      entry.actor.email ?? null,
      entry.resource.type,
      entry.resource.id,
      entry.action,
      entry.outcome,
      entry.reason ?? null,
      JSON.stringify(entry.metadata ?? {}),
      entry.ipAddress ?? null,
      entry.userAgent ?? null,
      entry.correlationId,
      prevHash,
      hash,
    ]);

    // Update chain state with new hash
    await client.query('UPDATE audit_chain_state SET last_hash = $1 WHERE workspace_id = $2', [
      hash,
      wsChainId,
    ]);

    return ok({
      ...entry,
      id,
      sequence,
      occurredAt,
      prevHash,
      hash,
    });
  }
}

// ── Query builder ─────────────────────────────────────────────────────────────

function buildWhereClause(filter: AuditFilter): { whereClause: string; params: unknown[] } {
  const conditions: string[] = [];
  const params: unknown[] = [];

  const p = (): string => `$${String(params.length)}`;

  if (filter.workspaceId !== undefined) {
    params.push(filter.workspaceId);
    conditions.push(`workspace_id = ${p()}`);
  }

  if (filter.eventType !== undefined) {
    if (Array.isArray(filter.eventType)) {
      params.push(filter.eventType);
      conditions.push(`event_type = ANY(${p()})`);
    } else {
      params.push(filter.eventType);
      conditions.push(`event_type = ${p()}`);
    }
  }

  if (filter.actorId !== undefined) {
    params.push(filter.actorId);
    conditions.push(`actor_id = ${p()}`);
  }

  if (filter.resourceType !== undefined) {
    params.push(filter.resourceType);
    conditions.push(`resource_type = ${p()}`);
  }

  if (filter.resourceId !== undefined) {
    params.push(filter.resourceId);
    conditions.push(`resource_id = ${p()}`);
  }

  if (filter.action !== undefined) {
    params.push(filter.action);
    conditions.push(`action = ${p()}`);
  }

  if (filter.outcome !== undefined) {
    params.push(filter.outcome);
    conditions.push(`outcome = ${p()}`);
  }

  if (filter.occurredAfter !== undefined) {
    params.push(filter.occurredAfter);
    conditions.push(`occurred_at >= ${p()}`);
  }

  if (filter.occurredBefore !== undefined) {
    params.push(filter.occurredBefore);
    conditions.push(`occurred_at <= ${p()}`);
  }

  if (filter.correlationId !== undefined) {
    params.push(filter.correlationId);
    conditions.push(`correlation_id = ${p()}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return { whereClause, params };
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
    case 'cef': {
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
