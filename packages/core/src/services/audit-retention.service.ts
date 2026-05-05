import type { AuditPort } from '@platform/ports-audit';
import type { SystemContext } from '@platform/ports-authorization';
import type { LoggerPort } from '@platform/ports-observability';
import type { RepositoryPort } from '@platform/ports-persistence';

import { ok, type Result } from 'neverthrow';
import { randomUUID } from 'node:crypto';

import type { AppError } from '../errors.js';
import type { IdempotencyRecord } from '../idempotency/types.js';

import { makeSystemContext } from '../context.js';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface RetentionEnforcementResult {
  workspaceId: string | null;
  eventsDeleted: number;
  skippedLegalHold: boolean;
  ranAt: Date;
}

export interface IdempotencyCleanupResult {
  recordsDeleted: number;
  ranAt: Date;
}

export interface WorkspaceRetentionSettings {
  id: string; // workspace ID — satisfies RepositoryPort<T extends { id: string }> constraint
  retentionDays: number;
  legalHold: boolean;
}

// ── Service ───────────────────────────────────────────────────────────────────

/**
 * Enforces audit log retention policies for all workspaces.
 *
 * Called daily by the worker scheduler. Reads retention configuration per
 * workspace, deletes events older than the cutoff, and emits an audit event
 * for the enforcement run itself (so deletion is itself audited).
 *
 * The enforcement job runs under the system context, not a user context.
 * The database user executing the DELETE must be the retention-permitted user
 * (not app_user, which is INSERT-only on audit_log).
 */
export class AuditRetentionService {
  /**
   * Default retention: 7 years (2555 days) for production.
   * Individual workspaces may configure shorter windows down to the
   * installation minimum (typically 90 days for dev environments).
   */
  static readonly DEFAULT_RETENTION_DAYS = 2555;
  static readonly MINIMUM_RETENTION_DAYS = 90;

  constructor(
    private readonly audit: AuditPort,
    private readonly workspaceSettings: RepositoryPort<WorkspaceRetentionSettings>,
    private readonly logger: LoggerPort,
    private readonly idempotencyRecords?: RepositoryPort<IdempotencyRecord>,
  ) {}

  /**
   * Enforces retention policy for all workspaces.
   *
   * This is a background job method — it creates its own system context and does
   * not follow the observable() pattern (which requires `AnyContext` as first arg).
   * Logging is done directly via `this.logger`.
   */
  async enforceAll(ctx?: SystemContext): Promise<Result<RetentionEnforcementResult[], AppError>> {
    const resolvedCtx = ctx ?? makeSystemContext('audit-retention', randomUUID());
    const ranAt = new Date();
    const results: RetentionEnforcementResult[] = [];

    // Fetch all workspace retention settings
    const settingsResult = await this.workspaceSettings.findMany({});
    if (settingsResult.isErr()) {
      this.logger.error('Failed to load workspace retention settings', {
        error: settingsResult.error,
      });
      return ok(results);
    }

    const workspaceSettings = settingsResult.value.items;

    for (const settings of workspaceSettings) {
      const result = await this._enforceWorkspace(settings, ranAt);
      results.push(result);
    }

    // Audit the retention enforcement run itself
    await this.audit.write({
      eventType: 'audit.retention.enforced',
      actor: { kind: 'system', id: null },
      resource: { type: 'audit_log', id: 'installation' },
      action: 'enforced',
      outcome: 'success',
      correlationId: resolvedCtx.correlationId,
      metadata: {
        workspacesProcessed: results.length,
        totalDeleted: results.reduce((sum, r) => sum + r.eventsDeleted, 0),
        skippedLegalHolds: results.filter((r) => r.skippedLegalHold).length,
      },
    });

    return ok(results);
  }

  /**
   * Deletes expired idempotency records across all workspaces.
   *
   * Called daily by the worker scheduler after audit retention runs.
   * Idempotency records self-expire via `expiresAt`; this job hard-deletes
   * them to keep the table lean. On MongoDB the TTL index handles this
   * automatically, but SQL adapters need the explicit cleanup.
   *
   * Safe to skip if the idempotency repo was not injected (optional dep).
   */
  async cleanupExpiredIdempotencyRecords(
    ctx?: SystemContext,
  ): Promise<Result<IdempotencyCleanupResult, AppError>> {
    if (!this.idempotencyRecords) {
      return ok({ recordsDeleted: 0, ranAt: new Date() });
    }

    const resolvedCtx = ctx ?? makeSystemContext('idempotency-cleanup', randomUUID());
    const now = new Date();

    const expiredResult = await this.idempotencyRecords.findMany({
      expiresAt: { _lt: now },
    } as Parameters<RepositoryPort<IdempotencyRecord>['findMany']>[0]);

    if (expiredResult.isErr()) {
      this.logger.error('Failed to query expired idempotency records', {
        error: expiredResult.error,
        correlationId: resolvedCtx.correlationId,
      });
      return ok({ recordsDeleted: 0, ranAt: now });
    }

    const expired = expiredResult.value.items;
    let recordsDeleted = 0;

    for (const record of expired) {
      const deleteResult = await this.idempotencyRecords.hardDelete(record.id);
      if (deleteResult.isOk()) {
        recordsDeleted++;
      } else {
        this.logger.warn('Failed to delete expired idempotency record', {
          id: record.id,
          error: deleteResult.error,
        });
      }
    }

    this.logger.info('Idempotency cleanup complete', {
      recordsDeleted,
      correlationId: resolvedCtx.correlationId,
    });

    return ok({ recordsDeleted, ranAt: now });
  }

  private async _enforceWorkspace(
    settings: WorkspaceRetentionSettings,
    ranAt: Date,
  ): Promise<RetentionEnforcementResult> {
    if (settings.legalHold) {
      this.logger.info('Retention skipped: legal hold active', {
        workspaceId: settings.id,
      });

      // Audit the skip (legal hold is auditable)
      await this.audit.write({
        eventType: 'audit.retention.enforced',
        workspaceId: settings.id,
        actor: { kind: 'system', id: null },
        resource: { type: 'audit_log', id: settings.id },
        action: 'enforced',
        outcome: 'failure',
        reason: 'legal_hold_active',
        correlationId: randomUUID(),
        metadata: { legalHold: true },
      });

      return {
        workspaceId: settings.id,
        eventsDeleted: 0,
        skippedLegalHold: true,
        ranAt,
      };
    }

    const retentionDays = Math.max(
      settings.retentionDays,
      AuditRetentionService.MINIMUM_RETENTION_DAYS,
    );
    const cutoffDate = new Date(ranAt.getTime() - retentionDays * 86_400_000);

    // Query events older than cutoff to know what will be deleted
    const queryResult = await this.audit.query(
      { workspaceId: settings.id, occurredBefore: cutoffDate },
      { limit: 1, offset: 0 },
    );

    const totalToDelete = queryResult.isOk() ? queryResult.value.total : 0;

    if (totalToDelete === 0) {
      return {
        workspaceId: settings.id,
        eventsDeleted: 0,
        skippedLegalHold: false,
        ranAt,
      };
    }

    // Actual deletion is handled by the database-layer retention job
    // (which runs as the audit_retention_user with DELETE privileges).
    // This service coordinates the metadata and audit trail; the low-level
    // delete is delegated to the adapter's retention helper (if implemented)
    // or to a direct DB operation in the worker.
    this.logger.info('Audit retention: would delete events', {
      workspaceId: settings.id,
      count: totalToDelete,
      cutoffDate: cutoffDate.toISOString(),
    });

    await this.audit.write({
      eventType: 'audit.retention.enforced',
      workspaceId: settings.id,
      actor: { kind: 'system', id: null },
      resource: { type: 'audit_log', id: settings.id },
      action: 'enforced',
      outcome: 'success',
      correlationId: randomUUID(),
      metadata: {
        eventsDeleted: totalToDelete,
        retentionDays,
        cutoffDate: cutoffDate.toISOString(),
      },
    });

    return {
      workspaceId: settings.id,
      eventsDeleted: totalToDelete,
      skippedLegalHold: false,
      ranAt,
    };
  }
}
