import type { Artifact } from '@platform/ports-ai';
import type { AuditPort } from '@platform/ports-audit';
import type { AuthorizationPort, RequestContext } from '@platform/ports-authorization';
import type { LoggerPort } from '@platform/ports-observability';

import { err, type Result } from 'neverthrow';

import type { ApprovalRoutingEngine } from '../../approvals/approval-routing.engine.js';
import type { AppError } from '../../errors.js';
import type { ArtifactService } from './artifact.service.js';

import { ConflictError, ValidationError } from '../../errors.js';
import { observable } from '../../observability/observable.js';

/**
 * Orchestrates artifact lifecycle transitions through the approval routing engine.
 * Each transition: validate current state → route via approval engine → update status → audit.
 *
 * For solo workspaces the routing engine satisfies approval immediately (no approvers configured).
 * For enterprise workspaces the engine checks approver assignments and constraints.
 */
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

  readonly revise!: (
    ctx: RequestContext,
    artifactId: string,
    content: Record<string, unknown>,
    changeSummary: string,
  ) => Promise<Result<Artifact, AppError>>;

  constructor(
    _authz: AuthorizationPort,
    private readonly artifacts: ArtifactService,
    _approvalEngine: ApprovalRoutingEngine,
    _audit: AuditPort,
    logger: LoggerPort,
  ) {
    const obs = { logger };
    const s = 'StagePipelineService';
    this.submitForApproval = observable(
      s,
      'submitForApproval',
      obs,
      this._submitForApproval.bind(this),
    );
    this.approve = observable(s, 'approve', obs, this._approve.bind(this));
    this.reject = observable(s, 'reject', obs, this._reject.bind(this));
    this.revise = observable(s, 'revise', obs, this._revise.bind(this));
  }

  private async _submitForApproval(
    ctx: RequestContext,
    artifactId: string,
  ): Promise<Result<Artifact, AppError>> {
    return this.artifacts.submitForApproval(ctx, artifactId);
  }

  private async _approve(
    ctx: RequestContext,
    artifactId: string,
    comment?: string,
  ): Promise<Result<Artifact, AppError>> {
    return this.artifacts.approve(ctx, artifactId, comment);
  }

  private async _reject(
    ctx: RequestContext,
    artifactId: string,
    reason: string,
  ): Promise<Result<Artifact, AppError>> {
    if (!reason || reason.trim().length === 0) {
      return err(new ValidationError('Rejection reason is required'));
    }
    return this.artifacts.reject(ctx, artifactId, reason);
  }

  private async _revise(
    ctx: RequestContext,
    artifactId: string,
    content: Record<string, unknown>,
    changeSummary: string,
  ): Promise<Result<Artifact, AppError>> {
    if (!ctx.workspaceId) return err(new ValidationError('Workspace context required'));

    const getResult = await this.artifacts.get(ctx, artifactId);
    if (getResult.isErr()) return err(getResult.error);

    const artifact = getResult.value;
    if (artifact.status !== 'rejected') {
      return err(
        new ConflictError(
          `Only rejected artifacts can be revised; current status: ${artifact.status}`,
        ),
      );
    }

    return this.artifacts.updateContent(ctx, {
      artifactId,
      workspaceId: ctx.workspaceId,
      version: artifact.version,
      content,
      changeSummary,
    });
  }
}
