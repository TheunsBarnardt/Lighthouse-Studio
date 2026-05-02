import type { AuditPort } from '@platform/ports-audit';
import type { AuthorizationPort, RequestContext, Workspace } from '@platform/ports-authorization';
import type { LoggerPort } from '@platform/ports-observability';
import type { RepositoryPort } from '@platform/ports-persistence';

import { err, ok, type Result } from 'neverthrow';
import { uuidv7 } from 'uuidv7';
import { z } from 'zod';

import type { AppError } from '../errors.js';

import { auditMeta } from '../context.js';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  WorkspaceContextRequiredError,
} from '../errors.js';

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

// ── Repository type used by this service ──────────────────────────────────────

type WorkspaceRepo = RepositoryPort<Workspace>;
type MemberRepo = RepositoryPort<{
  id: string;
  workspaceId: string;
  userId: string;
  status: string;
}>;

// ── Service ───────────────────────────────────────────────────────────────────

export class WorkspaceService {
  constructor(
    private readonly authz: AuthorizationPort,
    private readonly workspaces: WorkspaceRepo,
    private readonly members: MemberRepo,
    private readonly audit: AuditPort,
    private readonly logger: LoggerPort,
  ) {}

  async create(
    ctx: RequestContext,
    input: CreateWorkspaceInput,
  ): Promise<Result<Workspace, AppError>> {
    // 1. Authorize — any authenticated user can create a workspace
    const authResult = await this.authz.authorize(ctx, 'workspace.create', 'workspace');
    if (authResult.isErr()) {
      await this._logDeny(ctx, 'workspace.create', 'workspace', null);
      return err(new ForbiddenError(authResult.error.message));
    }

    // 2. Validate
    const parsed = CreateWorkspaceInputSchema.safeParse(input);
    if (!parsed.success) {
      return err(
        new ValidationError(
          'Invalid workspace input',
          parsed.error.issues.map((i) => ({
            path: i.path.join('.'),
            message: i.message,
          })),
        ),
      );
    }

    // 3. Check slug uniqueness
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
      workspaceId: workspace.id,
      actorId: ctx.userId,
      action: 'workspace.created',
      resourceType: 'workspace',
      resourceId: workspace.id,
      after: { id: workspace.id, name: workspace.name, slug: workspace.slug },
      occurredAt: now,
      ...auditMeta(ctx),
    });

    this.logger.info('Workspace created', { workspaceId: workspace.id, slug: workspace.slug });
    return ok(createResult.value);
  }

  async update(
    ctx: RequestContext,
    input: UpdateWorkspaceInput,
  ): Promise<Result<Workspace, AppError>> {
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());

    // 1. Authorize
    const authResult = await this.authz.authorize(ctx, 'workspace.update', 'workspace');
    if (authResult.isErr()) {
      await this._logDeny(ctx, 'workspace.update', 'workspace', input.id);
      return err(new ForbiddenError(authResult.error.message));
    }

    // 2. Validate
    const parsed = UpdateWorkspaceInputSchema.safeParse(input);
    if (!parsed.success) {
      return err(
        new ValidationError(
          'Invalid update input',
          parsed.error.issues.map((i) => ({
            path: i.path.join('.'),
            message: i.message,
          })),
        ),
      );
    }

    // 3. Fetch (confirms it exists in this workspace)
    const fetchResult = await this.workspaces.findById(parsed.data.id);
    if (fetchResult.isErr()) return err(new ConflictError(fetchResult.error.message));
    if (!fetchResult.value) return err(new NotFoundError('workspace', parsed.data.id));
    const before = fetchResult.value;

    // 4. Update with optimistic locking
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
      workspaceId: ctx.workspaceId,
      actorId: ctx.userId,
      action: 'workspace.updated',
      resourceType: 'workspace',
      resourceId: parsed.data.id,
      before: { name: before.name, description: before.description },
      after: { name: updateResult.value.name, description: updateResult.value.description },
      occurredAt: new Date(),
      ...auditMeta(ctx),
    });

    return ok(updateResult.value);
  }

  async archive(
    ctx: RequestContext,
    input: ArchiveWorkspaceInput,
  ): Promise<Result<void, AppError>> {
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());

    // 1. Authorize
    const authResult = await this.authz.authorize(ctx, 'workspace.archive', 'workspace');
    if (authResult.isErr()) {
      await this._logDeny(ctx, 'workspace.archive', 'workspace', input.id);
      return err(new ForbiddenError(authResult.error.message));
    }

    // 2. Validate
    const parsed = ArchiveWorkspaceInputSchema.safeParse(input);
    if (!parsed.success) {
      return err(
        new ValidationError(
          'Invalid archive input',
          parsed.error.issues.map((i) => ({
            path: i.path.join('.'),
            message: i.message,
          })),
        ),
      );
    }

    // 3. Fetch
    const fetchResult = await this.workspaces.findById(parsed.data.id);
    if (fetchResult.isErr()) return err(new ConflictError(fetchResult.error.message));
    if (!fetchResult.value) return err(new NotFoundError('workspace', parsed.data.id));

    // 4. Set archived_reason then archive
    if (parsed.data.reason) {
      await this.workspaces.update(
        parsed.data.id,
        { archivedReason: parsed.data.reason },
        {
          expectedVersion: parsed.data.version,
        },
      );
    }

    const archiveResult = await this.workspaces.archive(parsed.data.id);
    if (archiveResult.isErr()) return err(new NotFoundError('workspace', parsed.data.id));

    // 5. Audit
    await this.audit.write({
      workspaceId: ctx.workspaceId,
      actorId: ctx.userId,
      action: 'workspace.archived',
      resourceType: 'workspace',
      resourceId: parsed.data.id,
      after: { reason: parsed.data.reason ?? null },
      occurredAt: new Date(),
      ...auditMeta(ctx),
    });

    return ok(undefined);
  }

  async restore(ctx: RequestContext, id: string): Promise<Result<Workspace, AppError>> {
    // Restoring requires installation-level admin (workspace is archived, context may lack workspaceId)
    const authResult = await this.authz.authorize(ctx, 'workspace.restore', 'workspace');
    if (authResult.isErr()) {
      await this._logDeny(ctx, 'workspace.restore', 'workspace', id);
      return err(new ForbiddenError(authResult.error.message));
    }

    const updateResult = await this.workspaces.update(id, {
      archivedReason: null,
      updatedBy: ctx.userId,
      updatedAt: new Date(),
    });
    if (updateResult.isErr()) return err(new NotFoundError('workspace', id));

    await this.audit.write({
      workspaceId: id,
      actorId: ctx.userId,
      action: 'workspace.restored',
      resourceType: 'workspace',
      resourceId: id,
      occurredAt: new Date(),
      ...auditMeta(ctx),
    });

    return ok(updateResult.value);
  }

  async transferOwnership(
    ctx: RequestContext,
    input: TransferOwnershipInput,
  ): Promise<Result<Workspace, AppError>> {
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());

    // 1. Authorize — only workspace_owner or installation_owner
    const authResult = await this.authz.authorize(ctx, 'workspace.transfer_ownership', 'workspace');
    if (authResult.isErr()) {
      await this._logDeny(ctx, 'workspace.transfer_ownership', 'workspace', input.id);
      return err(new ForbiddenError(authResult.error.message));
    }

    // 2. Validate
    const parsed = TransferOwnershipInputSchema.safeParse(input);
    if (!parsed.success) {
      return err(
        new ValidationError(
          'Invalid transfer input',
          parsed.error.issues.map((i) => ({
            path: i.path.join('.'),
            message: i.message,
          })),
        ),
      );
    }

    // 3. Verify new owner is an active member
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

    // 4. Update
    const updateResult = await this.workspaces.update(
      parsed.data.id,
      { ownerUserId: parsed.data.newOwnerUserId, updatedBy: ctx.userId, updatedAt: new Date() },
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
      workspaceId: ctx.workspaceId,
      actorId: ctx.userId,
      action: 'workspace.ownership_transferred',
      resourceType: 'workspace',
      resourceId: parsed.data.id,
      after: { newOwnerUserId: parsed.data.newOwnerUserId },
      occurredAt: new Date(),
      ...auditMeta(ctx),
    });

    return ok(updateResult.value);
  }

  async delete(ctx: RequestContext, id: string): Promise<Result<void, AppError>> {
    // Hard delete — installation_owner only
    const authResult = await this.authz.authorize(ctx, 'workspace.delete', 'workspace');
    if (authResult.isErr()) {
      await this._logDeny(ctx, 'workspace.delete', 'workspace', id);
      return err(new ForbiddenError(authResult.error.message));
    }

    const deleteResult = await this.workspaces.hardDelete(id);
    if (deleteResult.isErr()) return err(new NotFoundError('workspace', id));

    await this.audit.write({
      workspaceId: id,
      actorId: ctx.userId,
      action: 'workspace.deleted',
      resourceType: 'workspace',
      resourceId: id,
      occurredAt: new Date(),
      ...auditMeta(ctx),
    });

    return ok(undefined);
  }

  async getById(ctx: RequestContext, id: string): Promise<Result<Workspace, AppError>> {
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());

    const authResult = await this.authz.authorize(ctx, 'workspace.read', 'workspace');
    if (authResult.isErr()) {
      await this._logDeny(ctx, 'workspace.read', 'workspace', id);
      return err(new ForbiddenError(authResult.error.message));
    }

    const result = await this.workspaces.findById(id);
    if (result.isErr()) return err(new ConflictError(result.error.message));
    if (!result.value) return err(new NotFoundError('workspace', id));

    // Enforce: the workspace id must match the context workspace id
    if (result.value.id !== ctx.workspaceId) return err(new ForbiddenError('Access denied'));

    return ok(result.value);
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private async _logDeny(
    ctx: RequestContext,
    action: string,
    resourceType: string,
    resourceId: string | null,
  ): Promise<void> {
    await this.audit.write({
      workspaceId: ctx.workspaceId ?? 'installation',
      actorId: ctx.userId,
      action: `${action}.denied`,
      resourceType,
      resourceId: resourceId ?? ctx.userId,
      occurredAt: new Date(),
      ...auditMeta(ctx),
    });
  }
}
