import type {
  Artifact,
  ArtifactFilter,
  ArtifactRepositoryPort,
  CreateArtifactInput,
  PaginatedArtifacts,
  QualitySignal,
  ReasoningRecord,
  StageName,
  UpdateArtifactInput,
} from '@platform/ports-ai-artifacts';
import type { AuditPort } from '@platform/ports-audit';
import type { AuthorizationPort, RequestContext } from '@platform/ports-authorization';
import type { LoggerPort } from '@platform/ports-observability';
import type { Result } from 'neverthrow';

import { err, ok } from 'neverthrow';

import type { AppError } from '../../errors.js';

import { toAuditActor, auditMeta } from '../../context.js';
import { ForbiddenError, InternalError, NotFoundError, ValidationError } from '../../errors.js';
import { observable } from '../../observability/observable.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CreateArtifactServiceInput {
  stage: StageName;
  type: string;
  parentArtifactIds?: string[];
  content: unknown;
  reasoning: ReasoningRecord;
  generatedBy?: Artifact['generatedBy'];
}

export interface UpdateArtifactServiceInput {
  id: string;
  expectedVersion: number;
  content?: unknown;
  reasoning?: Partial<ReasoningRecord>;
}

export interface ListArtifactsOptions {
  stage?: StageName;
  type?: string;
  status?: Artifact['status'] | Artifact['status'][];
  limit?: number;
  offset?: number;
}

// ── Audit events ──────────────────────────────────────────────────────────────

const EVENTS = {
  CREATED: 'ai.artifact.created',
  UPDATED: 'ai.artifact.updated',
  ARCHIVED: 'ai.artifact.archived',
} as const;

// ── Service ───────────────────────────────────────────────────────────────────

export class ArtifactService {
  readonly create!: (
    ctx: RequestContext,
    input: CreateArtifactServiceInput,
  ) => Promise<Result<Artifact, AppError>>;

  readonly get!: (ctx: RequestContext, artifactId: string) => Promise<Result<Artifact, AppError>>;

  readonly list!: (
    ctx: RequestContext,
    opts?: ListArtifactsOptions,
  ) => Promise<Result<PaginatedArtifacts, AppError>>;

  readonly listByParent!: (
    ctx: RequestContext,
    parentArtifactId: string,
  ) => Promise<Result<Artifact[], AppError>>;

  readonly update!: (
    ctx: RequestContext,
    input: UpdateArtifactServiceInput,
  ) => Promise<Result<Artifact, AppError>>;

  readonly archive!: (ctx: RequestContext, artifactId: string) => Promise<Result<void, AppError>>;

  readonly recordQualitySignal!: (
    ctx: RequestContext,
    artifactId: string,
    signal: QualitySignal,
  ) => Promise<Result<void, AppError>>;

  constructor(
    private readonly authz: AuthorizationPort,
    private readonly artifactRepo: ArtifactRepositoryPort,
    private readonly audit: AuditPort,
    private readonly logger: LoggerPort,
  ) {
    const obs = { logger: this.logger };
    const s = 'ArtifactService';
    this.create = observable(s, 'create', obs, this._create.bind(this));
    this.get = observable(s, 'get', obs, this._get.bind(this));
    this.list = observable(s, 'list', obs, this._list.bind(this));
    this.listByParent = observable(s, 'listByParent', obs, this._listByParent.bind(this));
    this.update = observable(s, 'update', obs, this._update.bind(this));
    this.archive = observable(s, 'archive', obs, this._archive.bind(this));
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
    if (!ctx.workspaceId) return err(new ValidationError('Workspace context required'));

    const authzResult = await this.authz.authorize(ctx, `ai.${input.stage}.create`, input.stage);
    if (authzResult.isErr())
      return err(new ForbiddenError('Not authorized to create AI artifacts'));

    const createInput: CreateArtifactInput = {
      workspaceId: ctx.workspaceId,
      stage: input.stage,
      type: input.type,
      parentArtifactIds: input.parentArtifactIds ?? [],
      content: input.content,
      reasoning: input.reasoning,
      generatedBy: input.generatedBy,
      createdByUserId: ctx.userId,
    };

    const result = await this.artifactRepo.create(createInput);
    if (result.isErr()) {
      return err(new InternalError(`Failed to create artifact: ${result.error.message}`));
    }

    await this.audit.write({
      eventType: EVENTS.CREATED,
      workspaceId: ctx.workspaceId,
      actor: toAuditActor(ctx),
      resource: { type: 'ai_artifact', id: result.value.id },
      action: 'created',
      outcome: 'success',
      metadata: { ...auditMeta(ctx), stage: input.stage, type: input.type },
      correlationId: ctx.correlationId,
    });

    return ok(result.value);
  }

  private async _get(ctx: RequestContext, artifactId: string): Promise<Result<Artifact, AppError>> {
    if (!ctx.workspaceId) return err(new ValidationError('Workspace context required'));

    const authzResult = await this.authz.authorize(ctx, 'ai.artifact.read', artifactId);
    if (authzResult.isErr()) return err(new ForbiddenError('Not authorized to read artifacts'));

    const result = await this.artifactRepo.findById(artifactId, ctx.workspaceId);
    if (result.isErr()) return err(new InternalError(result.error.message));
    if (!result.value) return err(new NotFoundError('artifact', artifactId));

    return ok(result.value);
  }

  private async _list(
    ctx: RequestContext,
    opts?: ListArtifactsOptions,
  ): Promise<Result<PaginatedArtifacts, AppError>> {
    if (!ctx.workspaceId) return err(new ValidationError('Workspace context required'));

    const filter: ArtifactFilter = {
      workspaceId: ctx.workspaceId,
      ...(opts?.stage !== undefined && { stage: opts.stage }),
      ...(opts?.type !== undefined && { type: opts.type }),
      ...(opts?.status !== undefined && { status: opts.status }),
    };

    const result = await this.artifactRepo.findMany(filter, {
      limit: opts?.limit ?? 20,
      offset: opts?.offset ?? 0,
    });
    if (result.isErr()) return err(new InternalError(result.error.message));

    return ok(result.value);
  }

  private async _listByParent(
    ctx: RequestContext,
    parentArtifactId: string,
  ): Promise<Result<Artifact[], AppError>> {
    if (!ctx.workspaceId) return err(new ValidationError('Workspace context required'));

    const result = await this.artifactRepo.findByParent(parentArtifactId, ctx.workspaceId);
    if (result.isErr()) return err(new InternalError(result.error.message));

    return ok(result.value);
  }

  private async _update(
    ctx: RequestContext,
    input: UpdateArtifactServiceInput,
  ): Promise<Result<Artifact, AppError>> {
    if (!ctx.workspaceId) return err(new ValidationError('Workspace context required'));

    const authzResult = await this.authz.authorize(ctx, 'ai.artifact.edit', input.id);
    if (authzResult.isErr()) return err(new ForbiddenError('Not authorized to edit artifacts'));

    const updateInput: UpdateArtifactInput = {
      id: input.id,
      workspaceId: ctx.workspaceId,
      expectedVersion: input.expectedVersion,
      content: input.content,
    };

    const result = await this.artifactRepo.update(updateInput);
    if (result.isErr()) return err(new InternalError(result.error.message));

    await this.audit.write({
      eventType: EVENTS.UPDATED,
      workspaceId: ctx.workspaceId,
      actor: toAuditActor(ctx),
      resource: { type: 'ai_artifact', id: input.id },
      action: 'updated',
      outcome: 'success',
      metadata: { ...auditMeta(ctx) },
      correlationId: ctx.correlationId,
    });

    return ok(result.value);
  }

  private async _archive(ctx: RequestContext, artifactId: string): Promise<Result<void, AppError>> {
    if (!ctx.workspaceId) return err(new ValidationError('Workspace context required'));

    const authzResult = await this.authz.authorize(ctx, 'ai.artifact.delete', artifactId);
    if (authzResult.isErr()) return err(new ForbiddenError('Not authorized to archive artifacts'));

    const result = await this.artifactRepo.archive(artifactId, ctx.workspaceId);
    if (result.isErr()) return err(new InternalError(result.error.message));

    await this.audit.write({
      eventType: EVENTS.ARCHIVED,
      workspaceId: ctx.workspaceId,
      actor: toAuditActor(ctx),
      resource: { type: 'ai_artifact', id: artifactId },
      action: 'archived',
      outcome: 'success',
      metadata: { ...auditMeta(ctx) },
      correlationId: ctx.correlationId,
    });

    return ok(undefined);
  }

  private async _recordQualitySignal(
    ctx: RequestContext,
    artifactId: string,
    signal: QualitySignal,
  ): Promise<Result<void, AppError>> {
    if (!ctx.workspaceId) return err(new ValidationError('Workspace context required'));

    const result = await this.artifactRepo.recordQualitySignal(artifactId, ctx.workspaceId, signal);
    if (result.isErr()) return err(new InternalError(result.error.message));

    return ok(undefined);
  }
}
