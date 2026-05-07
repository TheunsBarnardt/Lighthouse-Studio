import type { Artifact, ArtifactRepositoryPort } from '@platform/ports-ai-artifacts';
import type { AuditPort } from '@platform/ports-audit';
import type { AuthorizationPort, RequestContext } from '@platform/ports-authorization';
import type { LoggerPort } from '@platform/ports-observability';
import type { Result } from 'neverthrow';

import { err, ok } from 'neverthrow';

import type { AppError } from '../../errors.js';

import { toAuditActor, auditMeta } from '../../context.js';
import { ForbiddenError, InternalError, NotFoundError, ValidationError } from '../../errors.js';
import { observable } from '../../observability/observable.js';

// ── Audit events ──────────────────────────────────────────────────────────────

const EVENTS = {
  SUBMITTED: 'ai.pipeline.artifact_submitted',
  APPROVED: 'ai.pipeline.artifact_approved',
  REJECTED: 'ai.pipeline.artifact_rejected',
} as const;

// ── Service ───────────────────────────────────────────────────────────────────

export class StagePipelineService {
  readonly submitForApproval!: (
    ctx: RequestContext,
    artifactId: string,
  ) => Promise<Result<Artifact, AppError>>;

  readonly approve!: (
    ctx: RequestContext,
    artifactId: string,
    comment?: string,
  ) => Promise<Result<Artifact, AppError>>;

  readonly reject!: (
    ctx: RequestContext,
    artifactId: string,
    reason: string,
  ) => Promise<Result<Artifact, AppError>>;

  constructor(
    private readonly authz: AuthorizationPort,
    private readonly artifacts: ArtifactRepositoryPort,
    private readonly audit: AuditPort,
    private readonly logger: LoggerPort,
  ) {
    const obs = { logger: this.logger };
    const s = 'StagePipelineService';
    this.submitForApproval = observable(
      s,
      'submitForApproval',
      obs,
      this._submitForApproval.bind(this),
    );
    this.approve = observable(s, 'approve', obs, this._approve.bind(this));
    this.reject = observable(s, 'reject', obs, this._reject.bind(this));
  }

  private async _submitForApproval(
    ctx: RequestContext,
    artifactId: string,
  ): Promise<Result<Artifact, AppError>> {
    if (!ctx.workspaceId) return err(new ValidationError('Workspace context required'));

    const authzResult = await this.authz.authorize(ctx, 'ai.artifact.submit', artifactId);
    if (authzResult.isErr()) return err(new ForbiddenError('Not authorized to submit artifacts'));

    const found = await this.artifacts.findById(artifactId, ctx.workspaceId);
    if (found.isErr()) return err(new InternalError(found.error.message));
    if (!found.value) return err(new NotFoundError('artifact', artifactId));

    const artifact = found.value;
    if (artifact.status !== 'draft' && artifact.status !== 'rejected') {
      return err(new ValidationError(`Cannot submit artifact in status '${artifact.status}'`));
    }

    const updated = await this.artifacts.update({
      id: artifactId,
      workspaceId: ctx.workspaceId,
      expectedVersion: artifact.currentVersion,
      status: 'awaiting_approval',
    });
    if (updated.isErr()) return err(new InternalError(updated.error.message));

    await this.audit.write({
      eventType: EVENTS.SUBMITTED,
      workspaceId: ctx.workspaceId,
      actor: toAuditActor(ctx),
      resource: { type: 'ai_artifact', id: artifactId },
      action: 'submitted',
      outcome: 'success',
      metadata: { ...auditMeta(ctx), stage: artifact.stage },
      correlationId: ctx.correlationId,
    });

    return ok(updated.value);
  }

  private async _approve(
    ctx: RequestContext,
    artifactId: string,
    comment?: string,
  ): Promise<Result<Artifact, AppError>> {
    if (!ctx.workspaceId) return err(new ValidationError('Workspace context required'));

    const authzResult = await this.authz.authorize(ctx, 'ai.artifact.approve', artifactId);
    if (authzResult.isErr()) return err(new ForbiddenError('Not authorized to approve artifacts'));

    const found = await this.artifacts.findById(artifactId, ctx.workspaceId);
    if (found.isErr()) return err(new InternalError(found.error.message));
    if (!found.value) return err(new NotFoundError('artifact', artifactId));
    const artifact = found.value;

    if (artifact.status !== 'awaiting_approval') {
      return err(new ValidationError(`Cannot approve artifact in status '${artifact.status}'`));
    }

    const now = new Date();
    const updated = await this.artifacts.update({
      id: artifactId,
      workspaceId: ctx.workspaceId,
      expectedVersion: artifact.currentVersion,
      status: 'approved',
      approvedAt: now,
      approvedByUserId: ctx.userId,
    });
    if (updated.isErr()) return err(new InternalError(updated.error.message));

    await this.artifacts.recordQualitySignal(artifactId, ctx.workspaceId, {
      type: 'approval',
      metadata: { comment },
    });

    await this.audit.write({
      eventType: EVENTS.APPROVED,
      workspaceId: ctx.workspaceId,
      actor: toAuditActor(ctx),
      resource: { type: 'ai_artifact', id: artifactId },
      action: 'approved',
      outcome: 'success',
      metadata: {
        ...auditMeta(ctx),
        stage: artifact.stage,
        ...(comment !== undefined && { comment }),
      },
      correlationId: ctx.correlationId,
    });

    return ok(updated.value);
  }

  private async _reject(
    ctx: RequestContext,
    artifactId: string,
    reason: string,
  ): Promise<Result<Artifact, AppError>> {
    if (!ctx.workspaceId) return err(new ValidationError('Workspace context required'));

    const authzResult = await this.authz.authorize(ctx, 'ai.artifact.approve', artifactId);
    if (authzResult.isErr()) return err(new ForbiddenError('Not authorized to reject artifacts'));

    const found = await this.artifacts.findById(artifactId, ctx.workspaceId);
    if (found.isErr()) return err(new InternalError(found.error.message));
    if (!found.value) return err(new NotFoundError('artifact', artifactId));
    const artifact = found.value;

    if (artifact.status !== 'awaiting_approval') {
      return err(new ValidationError(`Cannot reject artifact in status '${artifact.status}'`));
    }

    const updated = await this.artifacts.update({
      id: artifactId,
      workspaceId: ctx.workspaceId,
      expectedVersion: artifact.currentVersion,
      status: 'rejected',
    });
    if (updated.isErr()) return err(new InternalError(updated.error.message));

    await this.artifacts.recordQualitySignal(artifactId, ctx.workspaceId, {
      type: 'rejection',
      metadata: { reason },
    });

    await this.audit.write({
      eventType: EVENTS.REJECTED,
      workspaceId: ctx.workspaceId,
      actor: toAuditActor(ctx),
      resource: { type: 'ai_artifact', id: artifactId },
      action: 'rejected',
      outcome: 'success',
      metadata: { ...auditMeta(ctx), stage: artifact.stage, reason },
      correlationId: ctx.correlationId,
    });

    return ok(updated.value);
  }
}
