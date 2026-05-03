import type { AuditPort } from '@platform/ports-audit';
import type { AuthorizationPort, RequestContext, Workspace } from '@platform/ports-authorization';
import type { LoggerPort } from '@platform/ports-observability';
import type { RepositoryPort } from '@platform/ports-persistence';

import { err, ok, type Result } from 'neverthrow';
import { uuidv7 } from 'uuidv7';
import { z } from 'zod';

import type { AppError } from '../errors.js';

import { auditMeta, toAuditActor } from '../context.js';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  WorkspaceContextRequiredError,
} from '../errors.js';
import { observable } from '../observability/observable.js';

// ── Input schemas ──────────────────────────────────────────────────────────────

const CreateWorkspaceInputSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  description: z.string().max(2000).optional(),
  settings: z.record(z.unknown()).optional(),
});

const UpdateWorkspaceInputSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int().min(1),
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  settings: z.record(z.unknown()).optional(),
});

const ArchiveWorkspaceInputSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int().min(1),
  reason: z.string().max(500).optional(),
});

const TransferOwnershipInputSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int().min(1),
  newOwnerUserId: z.string().uuid(),
});

export type CreateWorkspaceInput = z.infer<typeof CreateWorkspaceInputSchema>;
export type UpdateWorkspaceInput = z.infer<typeof UpdateWorkspaceInputSchema>;
export type ArchiveWorkspaceInput = z.infer<typeof ArchiveWorkspaceInputSchema>;
export type TransferOwnershipInput = z.infer<typeof TransferOwnershipInputSchema>;

// ── Repository types ──────────────────────────────────────────────────────────

type WorkspaceRepo = RepositoryPort<Workspace>;
type MemberRepo = RepositoryPort<{
  id: string;
  workspaceId: string;
  userId: string;
  status: string;
}>;

// ── Service ───────────────────────────────────────────────────────────────────

/**
 * Reference implementation of the canonical service method shape.
 *
 * Public API is observable-wrapped (spans, logs, metrics on every call).
 * The pattern:
 *   1. Declare public methods as typed fields with `!` (definite assignment)
 *   2. Wire them in the constructor via observable() wrapping private `_impl` methods
 *   3. Private `_impl` methods contain the canonical-shape business logic
 *
 * This sidesteps `useDefineForClassFields` ordering issues — parameter properties
 * (e.g. `this.logger`) are guaranteed set before constructor body runs.
 *
 * Canonical shape: validate → authorize → precondition → execute → audit → return
 */
export class WorkspaceService {
  // ── Public API (observable-wrapped) ─────────────────────────────────────────
  // Declared as fields so observable() can wrap them at construction time.
  // `!` tells TypeScript "assigned in constructor; no initializer needed."
  readonly create!: (
    ctx: RequestContext,
    input: CreateWorkspaceInput,
  ) => Promise<Result<Workspace, AppError>>;

  readonly update!: (
    ctx: RequestContext,
    input: UpdateWorkspaceInput,
  ) => Promise<Result<Workspace, AppError>>;

  readonly archive!: (
    ctx: RequestContext,
    input: ArchiveWorkspaceInput,
  ) => Promise<Result<void, AppError>>;

  readonly restore!: (ctx: RequestContext, id: string) => Promise<Result<Workspace, AppError>>;

  readonly transferOwnership!: (
    ctx: RequestContext,
    input: TransferOwnershipInput,
  ) => Promise<Result<Workspace, AppError>>;

  readonly delete!: (ctx: RequestContext, id: string) => Promise<Result<void, AppError>>;

  readonly getById!: (ctx: RequestContext, id: string) => Promise<Result<Workspace, AppError>>;

  constructor(
    private readonly authz: AuthorizationPort,
    private readonly workspaces: WorkspaceRepo,
    private readonly members: MemberRepo,
    private readonly audit: AuditPort,
    private readonly logger: LoggerPort,
  ) {
    const obs = { logger };
    const s = 'WorkspaceService';
    this.create = observable(s, 'create', obs, this._create.bind(this));
    this.update = observable(s, 'update', obs, this._update.bind(this));
    this.archive = observable(s, 'archive', obs, this._archive.bind(this));
    this.restore = observable(s, 'restore', obs, this._restore.bind(this));
    this.transferOwnership = observable(
      s,
      'transferOwnership',
      obs,
      this._transferOwnership.bind(this),
    );
    this.delete = observable(s, 'delete', obs, this._delete.bind(this));
    this.getById = observable(s, 'getById', obs, this._getById.bind(this));
  }

  // ── Private implementations ──────────────────────────────────────────────────

  private async _create(
    ctx: RequestContext,
    input: CreateWorkspaceInput,
  ): Promise<Result<Workspace, AppError>> {
    // 1. Validate
    const parsed = CreateWorkspaceInputSchema.safeParse(input);
    if (!parsed.success) {
      return err(
        new ValidationError(
          'Invalid workspace input',
          parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        ),
      );
    }

    // 2. Authorize — any authenticated user can create a workspace
    const authResult = await this.authz.authorize(ctx, 'workspace.create', 'workspace');
    if (authResult.isErr()) {
      await this._logDeny(ctx, 'workspace.created', 'workspace', null);
      return err(new ForbiddenError(authResult.error.message));
    }

    // 3. Precondition: slug uniqueness within installation
    const existing = await this.workspaces.findOne({
      slug: { _eq: parsed.data.slug },
    } as Parameters<WorkspaceRepo['findOne']>[0]);
    if (existing.isErr()) return err(new ConflictError(existing.error.message));
    if (existing.value) {
      return err(new ConflictError(`Workspace slug '${parsed.data.slug}' is already taken`));
    }

    // 4. Execute
    const now = new Date();
    const workspace: Workspace = {
      id: uuidv7(),
      version: 1,
      name: parsed.data.name,
      slug: parsed.data.slug,
      description: parsed.data.description ?? null,
      ownerUserId: ctx.userId,
      settings: parsed.data.settings ?? {},
      archivedReason: null,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    };

    const createResult = await this.workspaces.create(workspace);
    if (createResult.isErr()) return err(new ConflictError(createResult.error.message));

    // 5. Audit
    await this.audit.write({
      eventType: 'workspace.created',
      workspaceId: workspace.id,
      actor: toAuditActor(ctx),
      resource: { type: 'workspace', id: workspace.id },
      action: 'created',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: { name: workspace.name, slug: workspace.slug },
      ...auditMeta(ctx),
    });

    this.logger.info('Workspace created', { workspaceId: workspace.id, slug: workspace.slug });

    // 6. Return
    return ok(createResult.value);
  }

  private async _update(
    ctx: RequestContext,
    input: UpdateWorkspaceInput,
  ): Promise<Result<Workspace, AppError>> {
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());

    // 1. Validate
    const parsed = UpdateWorkspaceInputSchema.safeParse(input);
    if (!parsed.success) {
      return err(
        new ValidationError(
          'Invalid update input',
          parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        ),
      );
    }

    // 2. Authorize
    const authResult = await this.authz.authorize(ctx, 'workspace.update', 'workspace');
    if (authResult.isErr()) {
      await this._logDeny(ctx, 'workspace.updated', 'workspace', parsed.data.id);
      return err(new ForbiddenError(authResult.error.message));
    }

    // 3. Precondition: workspace exists
    const fetchResult = await this.workspaces.findById(parsed.data.id);
    if (fetchResult.isErr()) return err(new ConflictError(fetchResult.error.message));
    if (!fetchResult.value) return err(new NotFoundError('workspace', parsed.data.id));
    const before = fetchResult.value;

    // 4. Execute — optimistic locking via expectedVersion
    const changes: Partial<Omit<Workspace, 'id'>> = {};
    if (parsed.data.name !== undefined) changes['name'] = parsed.data.name;
    if (parsed.data.description !== undefined) changes['description'] = parsed.data.description;
    if (parsed.data.settings !== undefined) changes['settings'] = parsed.data.settings;
    changes['updatedBy'] = ctx.userId;
    changes['updatedAt'] = new Date();

    const updateResult = await this.workspaces.update(parsed.data.id, changes, {
      expectedVersion: parsed.data.version,
    });
    if (updateResult.isErr()) {
      if (updateResult.error.message.includes('Version mismatch')) {
        return err(
          new ConflictError('Workspace was modified by another process. Reload and retry.'),
        );
      }
      return err(new NotFoundError('workspace', parsed.data.id));
    }

    // 5. Audit
    await this.audit.write({
      eventType: 'workspace.updated',
      workspaceId: ctx.workspaceId,
      actor: toAuditActor(ctx),
      resource: { type: 'workspace', id: parsed.data.id },
      action: 'updated',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: {
        before: { name: before.name, description: before.description },
        after: {
          name: updateResult.value.name,
          description: updateResult.value.description,
        },
      },
      ...auditMeta(ctx),
    });

    // 6. Return
    return ok(updateResult.value);
  }

  private async _archive(
    ctx: RequestContext,
    input: ArchiveWorkspaceInput,
  ): Promise<Result<void, AppError>> {
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());

    // 1. Validate
    const parsed = ArchiveWorkspaceInputSchema.safeParse(input);
    if (!parsed.success) {
      return err(
        new ValidationError(
          'Invalid archive input',
          parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        ),
      );
    }

    // 2. Authorize
    const authResult = await this.authz.authorize(ctx, 'workspace.archive', 'workspace');
    if (authResult.isErr()) {
      await this._logDeny(ctx, 'workspace.archived', 'workspace', parsed.data.id);
      return err(new ForbiddenError(authResult.error.message));
    }

    // 3. Precondition: workspace exists
    const fetchResult = await this.workspaces.findById(parsed.data.id);
    if (fetchResult.isErr()) return err(new ConflictError(fetchResult.error.message));
    if (!fetchResult.value) return err(new NotFoundError('workspace', parsed.data.id));

    // 4. Execute
    if (parsed.data.reason) {
      await this.workspaces.update(
        parsed.data.id,
        { archivedReason: parsed.data.reason },
        { expectedVersion: parsed.data.version },
      );
    }

    const archiveResult = await this.workspaces.archive(parsed.data.id);
    if (archiveResult.isErr()) return err(new NotFoundError('workspace', parsed.data.id));

    // 5. Audit
    await this.audit.write({
      eventType: 'workspace.archived',
      workspaceId: ctx.workspaceId,
      actor: toAuditActor(ctx),
      resource: { type: 'workspace', id: parsed.data.id },
      action: 'archived',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: { reason: parsed.data.reason ?? null },
      ...auditMeta(ctx),
    });

    // 6. Return
    return ok(undefined);
  }

  private async _restore(ctx: RequestContext, id: string): Promise<Result<Workspace, AppError>> {
    // 1. Validate
    if (!id || typeof id !== 'string') {
      return err(new ValidationError('id is required'));
    }

    // 2. Authorize
    const authResult = await this.authz.authorize(ctx, 'workspace.restore', 'workspace');
    if (authResult.isErr()) {
      await this._logDeny(ctx, 'workspace.restored', 'workspace', id);
      return err(new ForbiddenError(authResult.error.message));
    }

    // 3. Precondition: workspace exists
    const fetchResult = await this.workspaces.findById(id);
    if (fetchResult.isErr()) return err(new ConflictError(fetchResult.error.message));
    if (!fetchResult.value) return err(new NotFoundError('workspace', id));

    // 4. Execute
    const updateResult = await this.workspaces.update(id, {
      archivedReason: null,
      updatedBy: ctx.userId,
      updatedAt: new Date(),
    });
    if (updateResult.isErr()) return err(new NotFoundError('workspace', id));

    // 5. Audit
    await this.audit.write({
      eventType: 'workspace.restored',
      workspaceId: id,
      actor: toAuditActor(ctx),
      resource: { type: 'workspace', id },
      action: 'restored',
      outcome: 'success',
      correlationId: ctx.correlationId,
      ...auditMeta(ctx),
    });

    // 6. Return
    return ok(updateResult.value);
  }

  private async _transferOwnership(
    ctx: RequestContext,
    input: TransferOwnershipInput,
  ): Promise<Result<Workspace, AppError>> {
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());

    // 1. Validate
    const parsed = TransferOwnershipInputSchema.safeParse(input);
    if (!parsed.success) {
      return err(
        new ValidationError(
          'Invalid transfer input',
          parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        ),
      );
    }

    // 2. Authorize
    const authResult = await this.authz.authorize(ctx, 'workspace.transfer_ownership', 'workspace');
    if (authResult.isErr()) {
      await this._logDeny(ctx, 'workspace.transferred', 'workspace', parsed.data.id);
      return err(new ForbiddenError(authResult.error.message));
    }

    // 3. Precondition: new owner must be an active member
    const memberResult = await this.members.findOne({
      _and: [
        { workspaceId: { _eq: ctx.workspaceId } },
        { userId: { _eq: parsed.data.newOwnerUserId } },
        { status: { _eq: 'active' } },
      ],
    } as Parameters<MemberRepo['findOne']>[0]);
    if (memberResult.isErr()) return err(new ConflictError(memberResult.error.message));
    if (!memberResult.value) {
      return err(new ValidationError('New owner must be an active workspace member'));
    }

    // 4. Execute
    const updateResult = await this.workspaces.update(
      parsed.data.id,
      {
        ownerUserId: parsed.data.newOwnerUserId,
        updatedBy: ctx.userId,
        updatedAt: new Date(),
      },
      { expectedVersion: parsed.data.version },
    );
    if (updateResult.isErr()) {
      if (updateResult.error.message.includes('Version mismatch')) {
        return err(new ConflictError('Workspace was modified by another process.'));
      }
      return err(new NotFoundError('workspace', parsed.data.id));
    }

    // 5. Audit
    await this.audit.write({
      eventType: 'workspace.transferred',
      workspaceId: ctx.workspaceId,
      actor: toAuditActor(ctx),
      resource: { type: 'workspace', id: parsed.data.id },
      action: 'transferred',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: { newOwnerUserId: parsed.data.newOwnerUserId },
      ...auditMeta(ctx),
    });

    // 6. Return
    return ok(updateResult.value);
  }

  private async _delete(ctx: RequestContext, id: string): Promise<Result<void, AppError>> {
    // 1. Validate
    if (!id || typeof id !== 'string') {
      return err(new ValidationError('id is required'));
    }

    // 2. Authorize
    const authResult = await this.authz.authorize(ctx, 'workspace.delete', 'workspace');
    if (authResult.isErr()) {
      await this._logDeny(ctx, 'workspace.deleted', 'workspace', id);
      return err(new ForbiddenError(authResult.error.message));
    }

    // 3. Execute
    const deleteResult = await this.workspaces.hardDelete(id);
    if (deleteResult.isErr()) return err(new NotFoundError('workspace', id));

    // 4. Audit
    await this.audit.write({
      eventType: 'workspace.deleted',
      workspaceId: id,
      actor: toAuditActor(ctx),
      resource: { type: 'workspace', id },
      action: 'deleted',
      outcome: 'success',
      correlationId: ctx.correlationId,
      ...auditMeta(ctx),
    });

    // 5. Return
    return ok(undefined);
  }

  private async _getById(ctx: RequestContext, id: string): Promise<Result<Workspace, AppError>> {
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());

    // 1. Validate
    if (!id || typeof id !== 'string') {
      return err(new ValidationError('id is required'));
    }

    // 2. Authorize
    const authResult = await this.authz.authorize(ctx, 'workspace.read', 'workspace');
    if (authResult.isErr()) {
      await this._logDeny(ctx, 'workspace.read', 'workspace', id);
      return err(new ForbiddenError(authResult.error.message));
    }

    // 3. Execute + enforce workspace scoping
    const result = await this.workspaces.findById(id);
    if (result.isErr()) return err(new ConflictError(result.error.message));
    if (!result.value) return err(new NotFoundError('workspace', id));
    if (result.value.id !== ctx.workspaceId) return err(new ForbiddenError('Access denied'));

    // 4. Return
    return ok(result.value);
  }

  private async _logDeny(
    ctx: RequestContext,
    eventType: string,
    resourceType: string,
    resourceId: string | null,
  ): Promise<void> {
    await this.audit.write({
      eventType,
      ...(ctx.workspaceId != null ? { workspaceId: ctx.workspaceId } : {}),
      actor: toAuditActor(ctx),
      resource: { type: resourceType, id: resourceId ?? ctx.userId },
      action: eventType.split('.').at(-1) ?? eventType,
      outcome: 'denied',
      correlationId: ctx.correlationId,
      ...auditMeta(ctx),
    });
  }
}
