import type { AuditPort } from '@platform/ports-audit';
import type {
  AuthorizationPort,
  RequestContext,
  WorkspaceMember,
  WorkspaceMemberRole,
} from '@platform/ports-authorization';
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
  OwnerSelfOrphanError,
  ValidationError,
  WorkspaceContextRequiredError,
} from '../errors.js';
import { observable } from '../observability/observable.js';

// ── Input schemas ──────────────────────────────────────────────────────────────

const AddMemberInputSchema = z.object({
  userId: z.string().uuid(),
  roleIds: z.array(z.string().uuid()),
});

const ChangeRoleInputSchema = z.object({
  memberId: z.string().uuid(),
  addRoleIds: z.array(z.string().uuid()).optional(),
  removeRoleIds: z.array(z.string().uuid()).optional(),
});

const RemoveMemberInputSchema = z.object({
  memberId: z.string().uuid(),
  version: z.number().int().min(1),
});

export type AddMemberInput = z.infer<typeof AddMemberInputSchema>;
export type ChangeRoleInput = z.infer<typeof ChangeRoleInputSchema>;
export type RemoveMemberInput = z.infer<typeof RemoveMemberInputSchema>;

type MemberRepo = RepositoryPort<WorkspaceMember>;
type MemberRoleRepo = RepositoryPort<WorkspaceMemberRole>;
type WorkspaceRepo = RepositoryPort<{ id: string; ownerUserId: string; version: number }>;

// ── Service ───────────────────────────────────────────────────────────────────

export class MemberService {
  readonly addMember!: (
    ctx: RequestContext,
    input: AddMemberInput,
  ) => Promise<Result<WorkspaceMember, AppError>>;
  readonly changeRole!: (
    ctx: RequestContext,
    input: ChangeRoleInput,
  ) => Promise<Result<void, AppError>>;
  readonly remove!: (
    ctx: RequestContext,
    input: RemoveMemberInput,
  ) => Promise<Result<void, AppError>>;
  readonly listMembers!: (
    ctx: RequestContext,
    opts?: { includeArchived?: boolean },
  ) => Promise<Result<WorkspaceMember[], AppError>>;

  constructor(
    private readonly authz: AuthorizationPort,
    private readonly members: MemberRepo,
    private readonly memberRoles: MemberRoleRepo,
    private readonly workspaces: WorkspaceRepo,
    private readonly audit: AuditPort,
    private readonly logger: LoggerPort,
  ) {
    const obs = { logger };
    const s = 'MemberService';
    this.addMember = observable(s, 'addMember', obs, this._addMember.bind(this));
    this.changeRole = observable(s, 'changeRole', obs, this._changeRole.bind(this));
    this.remove = observable(s, 'remove', obs, this._remove.bind(this));
    this.listMembers = observable(s, 'listMembers', obs, this._listMembers.bind(this));
  }

  private async _addMember(
    ctx: RequestContext,
    input: AddMemberInput,
  ): Promise<Result<WorkspaceMember, AppError>> {
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());

    // 1. Validate
    const parsed = AddMemberInputSchema.safeParse(input);
    if (!parsed.success) {
      return err(
        new ValidationError(
          'Invalid add-member input',
          parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        ),
      );
    }

    // 2. Authorize
    const authResult = await this.authz.authorize(ctx, 'member.invite', 'member');
    if (authResult.isErr()) {
      await this._logDeny(ctx, 'workspace.member.invited', 'member', parsed.data.userId);
      return err(new ForbiddenError(authResult.error.message));
    }

    // 3. Precondition: not already a member
    const existing = await this.members.findOne({
      _and: [{ workspaceId: { _eq: ctx.workspaceId } }, { userId: { _eq: parsed.data.userId } }],
    } as Parameters<MemberRepo['findOne']>[0]);
    if (existing.isErr()) return err(new ConflictError(existing.error.message));
    if (existing.value) {
      return err(new ConflictError('User is already a workspace member'));
    }

    // 4. Execute — create member record (active, direct add, not invitation flow)
    const now = new Date();
    const member: WorkspaceMember = {
      id: uuidv7(),
      version: 1,
      workspaceId: ctx.workspaceId,
      userId: parsed.data.userId,
      status: 'active',
      invitedAt: now,
      acceptedAt: now,
      invitedByUserId: ctx.userId,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    };

    const createResult = await this.members.create(member);
    if (createResult.isErr()) return err(new ConflictError(createResult.error.message));

    for (const roleId of parsed.data.roleIds) {
      const roleGrant: WorkspaceMemberRole = {
        id: uuidv7(),
        version: 1,
        workspaceMemberId: createResult.value.id,
        roleId,
        grantedByUserId: ctx.userId,
        archivedAt: null,
        createdAt: now,
        updatedAt: now,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      };
      await this.memberRoles.create(roleGrant);
    }

    this.logger.info('Member added', { workspaceId: ctx.workspaceId, userId: parsed.data.userId });

    // 5. Audit
    await this.audit.write({
      eventType: 'workspace.member.invited',
      workspaceId: ctx.workspaceId,
      actor: toAuditActor(ctx),
      resource: { type: 'member', id: createResult.value.id },
      action: 'invited',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: { userId: parsed.data.userId, roleIds: parsed.data.roleIds },
      ...auditMeta(ctx),
    });

    // 6. Return
    return ok(createResult.value);
  }

  private async _changeRole(
    ctx: RequestContext,
    input: ChangeRoleInput,
  ): Promise<Result<void, AppError>> {
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());

    // 1. Validate
    const parsed = ChangeRoleInputSchema.safeParse(input);
    if (!parsed.success) {
      return err(
        new ValidationError(
          'Invalid role change input',
          parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        ),
      );
    }

    // 2. Authorize
    const authResult = await this.authz.authorize(ctx, 'role.assign', 'role');
    if (authResult.isErr()) {
      await this._logDeny(ctx, 'workspace.member.role_assigned', 'member', parsed.data.memberId);
      return err(new ForbiddenError(authResult.error.message));
    }

    // 3. Precondition: member belongs to this workspace
    const memberResult = await this.members.findOne({
      _and: [{ id: { _eq: parsed.data.memberId } }, { workspaceId: { _eq: ctx.workspaceId } }],
    } as Parameters<MemberRepo['findOne']>[0]);
    if (memberResult.isErr()) return err(new ConflictError(memberResult.error.message));
    if (!memberResult.value) return err(new NotFoundError('member', parsed.data.memberId));

    const now = new Date();

    // 4. Execute
    for (const roleId of parsed.data.addRoleIds ?? []) {
      const roleGrant: WorkspaceMemberRole = {
        id: uuidv7(),
        version: 1,
        workspaceMemberId: parsed.data.memberId,
        roleId,
        grantedByUserId: ctx.userId,
        archivedAt: null,
        createdAt: now,
        updatedAt: now,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      };
      await this.memberRoles.create(roleGrant);
    }

    for (const roleId of parsed.data.removeRoleIds ?? []) {
      const existing = await this.memberRoles.findOne({
        _and: [{ workspaceMemberId: { _eq: parsed.data.memberId } }, { roleId: { _eq: roleId } }],
      } as Parameters<MemberRoleRepo['findOne']>[0]);
      if (existing.isOk() && existing.value) {
        await this.memberRoles.archive(existing.value.id);
      }
    }

    // 5. Audit
    await this.audit.write({
      eventType: 'workspace.member.role_assigned',
      workspaceId: ctx.workspaceId,
      actor: toAuditActor(ctx),
      resource: { type: 'member', id: parsed.data.memberId },
      action: 'role_assigned',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: {
        added: parsed.data.addRoleIds ?? [],
        removed: parsed.data.removeRoleIds ?? [],
      },
      ...auditMeta(ctx),
    });

    // 6. Return
    return ok(undefined);
  }

  private async _remove(
    ctx: RequestContext,
    input: RemoveMemberInput,
  ): Promise<Result<void, AppError>> {
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());

    // 1. Validate
    const parsed = RemoveMemberInputSchema.safeParse(input);
    if (!parsed.success) {
      return err(
        new ValidationError(
          'Invalid remove input',
          parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        ),
      );
    }

    // 2. Authorize
    const authResult = await this.authz.authorize(ctx, 'member.remove', 'member');
    if (authResult.isErr()) {
      await this._logDeny(ctx, 'workspace.member.removed', 'member', parsed.data.memberId);
      return err(new ForbiddenError(authResult.error.message));
    }

    // 3. Precondition: member exists and belongs to this workspace
    const memberResult = await this.members.findOne({
      _and: [{ id: { _eq: parsed.data.memberId } }, { workspaceId: { _eq: ctx.workspaceId } }],
    } as Parameters<MemberRepo['findOne']>[0]);
    if (memberResult.isErr()) return err(new ConflictError(memberResult.error.message));
    if (!memberResult.value) return err(new NotFoundError('member', parsed.data.memberId));
    const member = memberResult.value;

    const workspaceResult = await this.workspaces.findById(ctx.workspaceId);
    if (workspaceResult.isErr()) return err(new ConflictError(workspaceResult.error.message));
    if (!workspaceResult.value) return err(new NotFoundError('workspace', ctx.workspaceId));

    if (workspaceResult.value.ownerUserId === member.userId) {
      const ownerCount = await this._countActiveOwners(ctx.workspaceId);
      if (ownerCount <= 1) {
        return err(new OwnerSelfOrphanError());
      }
    }

    // 4. Execute
    const archiveResult = await this.members.update(
      parsed.data.memberId,
      { status: 'archived', updatedBy: ctx.userId, updatedAt: new Date() },
      { expectedVersion: parsed.data.version },
    );
    if (archiveResult.isErr()) {
      if (archiveResult.error.message.includes('Version mismatch')) {
        return err(new ConflictError('Member record was modified by another process.'));
      }
      return err(new NotFoundError('member', parsed.data.memberId));
    }

    // 5. Audit
    await this.audit.write({
      eventType: 'workspace.member.removed',
      workspaceId: ctx.workspaceId,
      actor: toAuditActor(ctx),
      resource: { type: 'member', id: parsed.data.memberId },
      action: 'removed',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: { userId: member.userId },
      ...auditMeta(ctx),
    });

    // 6. Return
    return ok(undefined);
  }

  private async _listMembers(
    ctx: RequestContext,
    opts?: { includeArchived?: boolean },
  ): Promise<Result<WorkspaceMember[], AppError>> {
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());

    // 1. Authorize
    const authResult = await this.authz.authorize(ctx, 'member.list', 'member');
    if (authResult.isErr()) {
      await this._logDeny(ctx, 'workspace.member.listed', 'member', null);
      return err(new ForbiddenError(authResult.error.message));
    }

    // 2. Execute
    const filter = { workspaceId: { _eq: ctx.workspaceId } } as Parameters<
      MemberRepo['findMany']
    >[0] extends { filter?: infer F }
      ? F
      : never;
    const result = await this.members.findMany(
      opts?.includeArchived !== undefined
        ? { filter, includeArchived: opts.includeArchived }
        : { filter },
    );
    if (result.isErr()) return err(new ConflictError(result.error.message));

    // 3. Return
    return ok(result.value.items);
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private async _countActiveOwners(workspaceId: string): Promise<number> {
    const result = await this.members.count({
      _and: [{ workspaceId: { _eq: workspaceId } }, { status: { _eq: 'active' } }],
    } as Parameters<MemberRepo['count']>[0]);
    return result.isOk() ? result.value : 0;
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
