import type {
  AiError,
  Artifact,
  ArtifactOutcome,
  ArtifactRepositoryPort,
  CreateArtifactInput,
  GenerationRecord,
  ReasoningRecord,
  StageName,
} from '@platform/ports-ai';
import type { AuditPort } from '@platform/ports-audit';
import type { AuthorizationPort, RequestContext } from '@platform/ports-authorization';
import type { LoggerPort } from '@platform/ports-observability';

import { err, ok, type Result } from 'neverthrow';
import { z } from 'zod';

import type { AppError } from '../../errors.js';

import { AUDIT_EVENTS } from '../../compliance/audit-events.js';
import { toAuditActor } from '../../context.js';
import {
  AuthorizationError,
  ConflictError,
  ExternalServiceError,
  NotFoundError,
  ValidationError,
} from '../../errors.js';
import { observable } from '../../observability/observable.js';

const CreateArtifactInputSchema = z.object({
  workspaceId: z.string().uuid(),
  stage: z.string() as z.ZodType<StageName>,
  type: z.string().min(1),
  parentArtifactIds: z.array(z.string().uuid()),
  content: z.record(z.unknown()),
  reasoning: z.object({
    rationale: z.string().min(1),
    alternatives_considered: z.array(z.string()),
    assumptions: z.array(z.string()),
    uncertainties: z.array(z.string()),
    source_artifacts: z.array(z.string()),
  }),
  generatedBy: z.object({
    provider: z.string(),
    model: z.string(),
    promptId: z.string(),
    promptVersion: z.string(),
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
    toolUseTokens: z.number().int().nonnegative(),
    costUsd: z.number().nonnegative(),
    durationMs: z.number().int().nonnegative(),
    cached: z.boolean(),
  }),
  createdByUserId: z.string().uuid().nullable(),
});

const UpdateContentSchema = z.object({
  artifactId: z.string().uuid(),
  workspaceId: z.string().uuid(),
  version: z.number().int().min(1),
  content: z.record(z.unknown()),
  changeSummary: z.string().min(1).max(500),
});

const QualitySignalSchema = z.object({
  artifactId: z.string().uuid(),
  workspaceId: z.string().uuid(),
  outcome: z.enum(['accepted_first_pass', 'accepted_after_revisions', 'rejected', 'abandoned']),
  revisionCount: z.number().int().nonnegative(),
  editDistance: z.number().int().nonnegative().optional(),
  timeToApprovalSeconds: z.number().int().nonnegative().optional(),
  rejectedWithFeedback: z.string().optional(),
  causedDownstreamIssue: z.boolean(),
});

export type CreateArtifactServiceInput = {
  workspaceId: string;
  stage: StageName;
  type: string;
  parentArtifactIds: string[];
  content: Record<string, unknown>;
  reasoning: ReasoningRecord;
  generatedBy: GenerationRecord;
  createdByUserId: string | null;
};

export type UpdateContentInput = z.infer<typeof UpdateContentSchema>;
export type RecordQualityInput = z.infer<typeof QualitySignalSchema>;

function wrapRepoError(e: AiError): AppError {
  return new ExternalServiceError('artifact-repo', e.message, { cause: e });
}

export class ArtifactService {
  readonly create!: (
    ctx: RequestContext,
    input: CreateArtifactServiceInput,
  ) => Promise<Result<Artifact, AppError>>;

  readonly get!: (ctx: RequestContext, artifactId: string) => Promise<Result<Artifact, AppError>>;

  readonly listByStage!: (
    ctx: RequestContext,
    stage: StageName,
    opts?: { limit?: number; offset?: number },
  ) => Promise<Result<Artifact[], AppError>>;

  readonly updateContent!: (
    ctx: RequestContext,
    input: UpdateContentInput,
  ) => Promise<Result<Artifact, AppError>>;

  readonly archive!: (ctx: RequestContext, artifactId: string) => Promise<Result<void, AppError>>;

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

  readonly recordQualitySignal!: (
    ctx: RequestContext,
    input: RecordQualityInput,
  ) => Promise<Result<void, AppError>>;

  constructor(
    private readonly authz: AuthorizationPort,
    private readonly repo: ArtifactRepositoryPort,
    private readonly audit: AuditPort,
    logger: LoggerPort,
  ) {
    const obs = { logger };
    const s = 'ArtifactService';
    this.create = observable(s, 'create', obs, this._create.bind(this));
    this.get = observable(s, 'get', obs, this._get.bind(this));
    this.listByStage = observable(s, 'listByStage', obs, this._listByStage.bind(this));
    this.updateContent = observable(s, 'updateContent', obs, this._updateContent.bind(this));
    this.archive = observable(s, 'archive', obs, this._archive.bind(this));
    this.submitForApproval = observable(
      s,
      'submitForApproval',
      obs,
      this._submitForApproval.bind(this),
    );
    this.approve = observable(s, 'approve', obs, this._approve.bind(this));
    this.reject = observable(s, 'reject', obs, this._reject.bind(this));
    this.recordQualitySignal = observable(
      s,
      'recordQualitySignal',
      obs,
      this._recordQualitySignal.bind(this),
    );
  }

  private async _create(
    ctx: RequestContext,
    input: CreateArtifactServiceInput,
  ): Promise<Result<Artifact, AppError>> {
    const parsed = CreateArtifactInputSchema.safeParse(input);
    if (!parsed.success) {
      return err(
        new ValidationError(
          'Invalid artifact input',
          parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        ),
      );
    }

    const authResult = await this.authz.authorize(ctx, 'ai.artifact.create', 'artifact', {
      attributes: { stage: input.stage, workspaceId: input.workspaceId },
    });
    if (authResult.isErr()) return err(new AuthorizationError(authResult.error.message));

    const repoInput: CreateArtifactInput = {
      workspaceId: input.workspaceId,
      stage: input.stage,
      type: input.type,
      parentArtifactIds: input.parentArtifactIds,
      content: input.content,
      reasoning: input.reasoning,
      generatedBy: input.generatedBy,
      createdByUserId: input.createdByUserId,
    };

    const result = await this.repo.create(repoInput);
    if (result.isErr()) return err(wrapRepoError(result.error));

    await this.audit.write({
      eventType: AUDIT_EVENTS.AI_ARTIFACT_CREATED,
      actor: toAuditActor(ctx),
      resource: { type: 'artifact', id: result.value.id },
      action: 'created',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: { stage: input.stage, artifactType: input.type, workspaceId: input.workspaceId },
    });

    return ok(result.value);
  }

  private async _get(ctx: RequestContext, artifactId: string): Promise<Result<Artifact, AppError>> {
    if (!ctx.workspaceId) return err(new ValidationError('Workspace context required'));

    const authResult = await this.authz.authorize(ctx, 'ai.artifact.read', 'artifact', {
      resourceId: artifactId,
    });
    if (authResult.isErr()) return err(new AuthorizationError(authResult.error.message));

    const result = await this.repo.findById(artifactId, ctx.workspaceId);
    if (result.isErr()) return err(wrapRepoError(result.error));
    if (!result.value) return err(new NotFoundError('artifact', artifactId));
    return ok(result.value);
  }

  private async _listByStage(
    ctx: RequestContext,
    stage: StageName,
    opts?: { limit?: number; offset?: number },
  ): Promise<Result<Artifact[], AppError>> {
    if (!ctx.workspaceId) return err(new ValidationError('Workspace context required'));

    const authResult = await this.authz.authorize(ctx, 'ai.artifact.list', 'artifact');
    if (authResult.isErr()) return err(new AuthorizationError(authResult.error.message));

    const result = await this.repo.list(ctx.workspaceId, { stage, ...opts });
    if (result.isErr()) return err(wrapRepoError(result.error));
    return ok(result.value.items);
  }

  private async _updateContent(
    ctx: RequestContext,
    input: UpdateContentInput,
  ): Promise<Result<Artifact, AppError>> {
    const parsed = UpdateContentSchema.safeParse(input);
    if (!parsed.success) {
      return err(
        new ValidationError(
          'Invalid update input',
          parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        ),
      );
    }

    const authResult = await this.authz.authorize(ctx, 'ai.artifact.update', 'artifact', {
      resourceId: input.artifactId,
    });
    if (authResult.isErr()) return err(new AuthorizationError(authResult.error.message));

    const getResult = await this.repo.findById(input.artifactId, input.workspaceId);
    if (getResult.isErr()) return err(wrapRepoError(getResult.error));
    if (!getResult.value) return err(new NotFoundError('artifact', input.artifactId));

    if (getResult.value.version !== input.version) {
      return err(new ConflictError('Artifact version mismatch — reload and retry'));
    }

    // Save immutable version snapshot before update
    await this.repo.saveVersion(
      input.artifactId,
      getResult.value.currentVersion,
      getResult.value.content,
      getResult.value.reasoning,
      input.changeSummary,
      ctx.userId,
    );

    const updateResult = await this.repo.update(
      input.artifactId,
      input.workspaceId,
      input.version,
      {
        content: input.content,
        qualitySignals: {
          ...getResult.value.qualitySignals,
          revisionCount: getResult.value.qualitySignals.revisionCount + 1,
        },
      },
    );
    if (updateResult.isErr()) return err(wrapRepoError(updateResult.error));

    await this.audit.write({
      eventType: AUDIT_EVENTS.AI_ARTIFACT_UPDATED,
      actor: toAuditActor(ctx),
      resource: { type: 'artifact', id: input.artifactId },
      action: 'updated',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: { changeSummary: input.changeSummary },
    });

    return ok(updateResult.value);
  }

  private async _archive(ctx: RequestContext, artifactId: string): Promise<Result<void, AppError>> {
    if (!ctx.workspaceId) return err(new ValidationError('Workspace context required'));

    const authResult = await this.authz.authorize(ctx, 'ai.artifact.archive', 'artifact', {
      resourceId: artifactId,
    });
    if (authResult.isErr()) return err(new AuthorizationError(authResult.error.message));

    const result = await this.repo.archive(artifactId, ctx.workspaceId);
    if (result.isErr()) return err(wrapRepoError(result.error));

    await this.audit.write({
      eventType: AUDIT_EVENTS.AI_ARTIFACT_ARCHIVED,
      actor: toAuditActor(ctx),
      resource: { type: 'artifact', id: artifactId },
      action: 'archived',
      outcome: 'success',
      correlationId: ctx.correlationId,
    });

    return ok(undefined);
  }

  private async _submitForApproval(
    ctx: RequestContext,
    artifactId: string,
  ): Promise<Result<Artifact, AppError>> {
    if (!ctx.workspaceId) return err(new ValidationError('Workspace context required'));

    const getResult = await this.repo.findById(artifactId, ctx.workspaceId);
    if (getResult.isErr()) return err(wrapRepoError(getResult.error));
    if (!getResult.value) return err(new NotFoundError('artifact', artifactId));

    if (getResult.value.status !== 'draft') {
      return err(
        new ConflictError(`Artifact is in status ${getResult.value.status}, expected draft`),
      );
    }

    const updateResult = await this.repo.update(
      artifactId,
      ctx.workspaceId,
      getResult.value.version,
      { status: 'awaiting_approval' },
    );
    if (updateResult.isErr()) return err(wrapRepoError(updateResult.error));

    await this.audit.write({
      eventType: AUDIT_EVENTS.AI_ARTIFACT_SUBMITTED,
      actor: toAuditActor(ctx),
      resource: { type: 'artifact', id: artifactId },
      action: 'submitted',
      outcome: 'success',
      correlationId: ctx.correlationId,
    });

    return ok(updateResult.value);
  }

  private async _approve(
    ctx: RequestContext,
    artifactId: string,
    _comment?: string,
  ): Promise<Result<Artifact, AppError>> {
    if (!ctx.workspaceId) return err(new ValidationError('Workspace context required'));

    const authResult = await this.authz.authorize(ctx, 'ai.artifact.approve', 'artifact', {
      resourceId: artifactId,
    });
    if (authResult.isErr()) return err(new AuthorizationError(authResult.error.message));

    const getResult = await this.repo.findById(artifactId, ctx.workspaceId);
    if (getResult.isErr()) return err(wrapRepoError(getResult.error));
    if (!getResult.value) return err(new NotFoundError('artifact', artifactId));

    const updateResult = await this.repo.update(
      artifactId,
      ctx.workspaceId,
      getResult.value.version,
      {
        status: 'approved',
        approvedAt: new Date(),
        approvedByUserId: ctx.userId,
      },
    );
    if (updateResult.isErr()) return err(wrapRepoError(updateResult.error));

    await this.audit.write({
      eventType: AUDIT_EVENTS.AI_ARTIFACT_APPROVED,
      actor: toAuditActor(ctx),
      resource: { type: 'artifact', id: artifactId },
      action: 'approved',
      outcome: 'success',
      correlationId: ctx.correlationId,
    });

    return ok(updateResult.value);
  }

  private async _reject(
    ctx: RequestContext,
    artifactId: string,
    reason: string,
  ): Promise<Result<Artifact, AppError>> {
    if (!ctx.workspaceId) return err(new ValidationError('Workspace context required'));

    const authResult = await this.authz.authorize(ctx, 'ai.artifact.reject', 'artifact', {
      resourceId: artifactId,
    });
    if (authResult.isErr()) return err(new AuthorizationError(authResult.error.message));

    const getResult = await this.repo.findById(artifactId, ctx.workspaceId);
    if (getResult.isErr()) return err(wrapRepoError(getResult.error));
    if (!getResult.value) return err(new NotFoundError('artifact', artifactId));

    const updateResult = await this.repo.update(
      artifactId,
      ctx.workspaceId,
      getResult.value.version,
      {
        status: 'rejected',
        qualitySignals: {
          ...getResult.value.qualitySignals,
          rejectedWithFeedback: reason,
        },
      },
    );
    if (updateResult.isErr()) return err(wrapRepoError(updateResult.error));

    await this.audit.write({
      eventType: AUDIT_EVENTS.AI_ARTIFACT_REJECTED,
      actor: toAuditActor(ctx),
      resource: { type: 'artifact', id: artifactId },
      action: 'rejected',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: { reason },
    });

    return ok(updateResult.value);
  }

  private async _recordQualitySignal(
    ctx: RequestContext,
    input: RecordQualityInput,
  ): Promise<Result<void, AppError>> {
    const parsed = QualitySignalSchema.safeParse(input);
    if (!parsed.success) {
      return err(
        new ValidationError(
          'Invalid quality signal input',
          parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        ),
      );
    }

    const artifact = await this.repo.findById(input.artifactId, input.workspaceId);
    if (artifact.isErr()) return err(wrapRepoError(artifact.error));
    if (!artifact.value) return err(new NotFoundError('artifact', input.artifactId));

    await this.repo.recordQualitySignal({
      artifactId: input.artifactId,
      workspaceId: input.workspaceId,
      stage: artifact.value.stage,
      promptId: artifact.value.generatedBy.promptId,
      promptVersion: artifact.value.generatedBy.promptVersion,
      provider: artifact.value.generatedBy.provider,
      model: artifact.value.generatedBy.model,
      outcome: input.outcome as ArtifactOutcome,
      revisionCount: input.revisionCount,
      ...(input.editDistance !== undefined ? { editDistance: input.editDistance } : {}),
      ...(input.timeToApprovalSeconds !== undefined
        ? { timeToApprovalSeconds: input.timeToApprovalSeconds }
        : {}),
      ...(input.rejectedWithFeedback !== undefined
        ? { rejectedWithFeedback: input.rejectedWithFeedback }
        : {}),
      causedDownstreamIssue: input.causedDownstreamIssue,
    });

    await this.audit.write({
      eventType: AUDIT_EVENTS.AI_QUALITY_RECORDED,
      actor: toAuditActor(ctx),
      resource: { type: 'artifact', id: input.artifactId },
      action: 'recorded',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: { qualityOutcome: input.outcome, revisionCount: input.revisionCount },
    });

    return ok(undefined);
  }
}
