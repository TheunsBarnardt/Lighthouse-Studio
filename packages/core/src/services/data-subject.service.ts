import type { AuditPort } from '@platform/ports-audit';
import type { AuthorizationPort, RequestContext } from '@platform/ports-authorization';
import type { LoggerPort } from '@platform/ports-observability';

import { err, ok, type Result } from 'neverthrow';
import { randomUUID } from 'node:crypto';

import type { PersonalDataRecord } from '../compliance/personal-data-registry.js';
import type { AppError } from '../errors.js';

import { AUDIT_EVENTS } from '../compliance/audit-events.js';
import { personalDataRegistry } from '../compliance/personal-data-registry.js';
import { auditMeta, toAuditActor } from '../context.js';
import { ForbiddenError, NotFoundError } from '../errors.js';
import { observable } from '../observability/observable.js';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface DataSubjectAccessRequest {
  jobId: string;
  userId: string;
  requestedByUserId: string;
  requestedAt: Date;
  status: 'pending' | 'processing' | 'ready' | 'expired';
  downloadUrl?: string;
  expiresAt?: Date;
}

export interface ErasureRequest {
  jobId: string;
  userId: string;
  requestedByUserId: string;
  requestedAt: Date;
  gracePeriodEndsAt: Date;
  status: 'pending' | 'processing' | 'completed' | 'blocked_by_legal_hold';
}

export interface ErasureRequestOptions {
  gracePeriodDays?: number;
  reason?: string;
}

// ── Service ───────────────────────────────────────────────────────────────────

/**
 * Handles GDPR Article 15 (data subject access) and Article 17 (erasure) requests.
 *
 * Both operations are asynchronous (worker-processed) and are themselves audited.
 * The caller must hold either the 'data_subject' role (requesting for themselves)
 * or 'installation_admin' (requesting on behalf of another user).
 */
export class DataSubjectService {
  readonly startAccessRequest!: (
    ctx: RequestContext,
    targetUserId: string,
  ) => Promise<Result<DataSubjectAccessRequest, AppError>>;
  readonly startErasureRequest!: (
    ctx: RequestContext,
    targetUserId: string,
    opts?: ErasureRequestOptions,
  ) => Promise<Result<ErasureRequest, AppError>>;

  constructor(
    private readonly authz: AuthorizationPort,
    private readonly audit: AuditPort,
    private readonly logger: LoggerPort,
  ) {
    const obs = { logger };
    const s = 'DataSubjectService';
    this.startAccessRequest = observable(
      s,
      'startAccessRequest',
      obs,
      this._startAccessRequest.bind(this),
    );
    this.startErasureRequest = observable(
      s,
      'startErasureRequest',
      obs,
      this._startErasureRequest.bind(this),
    );
  }

  /**
   * Initiate a GDPR Article 15 data subject access request.
   * The requesting user must be the subject or an installation admin.
   */
  private async _startAccessRequest(
    ctx: RequestContext,
    targetUserId: string,
  ): Promise<Result<DataSubjectAccessRequest, AppError>> {
    // Only the user themselves or an installation admin may request access
    if (ctx.userId !== targetUserId) {
      const authResult = await this.authz.authorize(ctx, 'data_subject.export', 'user');
      if (authResult.isErr()) {
        return err(
          new ForbiddenError(
            'Only the user themselves or an installation admin may request access export',
          ),
        );
      }
    }

    const jobId = randomUUID();
    const requestedAt = new Date();

    await this.audit.write({
      eventType: AUDIT_EVENTS.DATA_SUBJECT_ACCESS_REQUESTED,
      actor: toAuditActor(ctx),
      resource: { type: 'user', id: targetUserId },
      action: 'access_requested',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: { jobId, targetUserId, requestedByUserId: ctx.userId },
      ...auditMeta(ctx),
    });

    // Delegate actual export work to the AuditPort (which enqueues an async job)
    const exportResult = await this.audit.startDataSubjectExport(targetUserId, ctx.userId);
    if (exportResult.isErr()) {
      this.logger.error('Failed to start data subject export', { error: exportResult.error });
      return err(new NotFoundError('user', targetUserId));
    }

    const job = exportResult.value;

    this.logger.info('Data subject access request initiated', {
      jobId: job.jobId,
      targetUserId,
      requestedByUserId: ctx.userId,
    });

    return ok({
      jobId: job.jobId,
      userId: targetUserId,
      requestedByUserId: ctx.userId,
      requestedAt,
      status: 'pending',
    });
  }

  private async _startErasureRequest(
    ctx: RequestContext,
    targetUserId: string,
    opts?: ErasureRequestOptions,
  ): Promise<Result<ErasureRequest, AppError>> {
    if (ctx.userId !== targetUserId) {
      const authResult = await this.authz.authorize(ctx, 'data_subject.erase', 'user');
      if (authResult.isErr()) {
        return err(
          new ForbiddenError(
            'Only the user themselves or an installation admin may request erasure',
          ),
        );
      }
    }

    await this.audit.write({
      eventType: AUDIT_EVENTS.DATA_SUBJECT_ERASURE_REQUESTED,
      actor: toAuditActor(ctx),
      resource: { type: 'user', id: targetUserId },
      action: 'erasure_requested',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: {
        requestedByUserId: ctx.userId,
        gracePeriodDays: opts?.gracePeriodDays ?? 30,
        reason: opts?.reason ?? null,
      },
      ...auditMeta(ctx),
    });

    const erasureResult = await this.audit.startErasureRequest(targetUserId, ctx.userId, opts);
    if (erasureResult.isErr()) {
      this.logger.error('Failed to start erasure request', { error: erasureResult.error });
      return err(new NotFoundError('user', targetUserId));
    }

    const job = erasureResult.value;

    this.logger.info('Data subject erasure request initiated', {
      jobId: job.jobId,
      targetUserId,
      requestedByUserId: ctx.userId,
      gracePeriodEndsAt: job.gracePeriodEndsAt.toISOString(),
    });

    return ok({
      jobId: job.jobId,
      userId: targetUserId,
      requestedByUserId: ctx.userId,
      requestedAt: job.requestedAt,
      gracePeriodEndsAt: job.gracePeriodEndsAt,
      status: job.status,
    });
  }

  getDataLocations(): PersonalDataRecord[] {
    return personalDataRegistry;
  }

  /**
   * Returns the list of PII locations that will be erased (deleted or anonymized)
   * on an erasure request.
   */
  getErasureableLocations(): PersonalDataRecord[] {
    return personalDataRegistry.filter((r) => r.eraseable);
  }
}
