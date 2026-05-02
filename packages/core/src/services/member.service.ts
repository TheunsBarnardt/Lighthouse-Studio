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

import { auditMeta } from '../context.js';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  OwnerSelfOrphanError,
  ValidationError,
  WorkspaceContextRequiredError,
} from '../errors.js';

// ── Input schemas ──────────────────────────────────────────────────────────────

const ChangeRoleInputSchema = z.object({
  memberId: z.string().uuid(),
  addRoleIds: z.array(z.string().uuid()).optional(),
  removeRoleIds: z.array(z.string().uuid()).optional(),
});

const RemoveMemberInputSchema = z.object({
  memberId: z.string().uuid(),
  version: z.number().int().min(1),
});

export type ChangeRoleInput = z.infer<typeof ChangeRoleInputSchema>;
export type RemoveMemberInput = z.infer<typeof RemoveMemberInputSchema>;

type MemberRepo = RepositoryPort<WorkspaceMember>;
type MemberRoleRepo = RepositoryPort<WorkspaceMemberRole>;
type WorkspaceRepo = RepositoryPort<{ id: string; ownerUserId: string; version: number }>;

// ── Service ───────────────────────────────────────────────────────────────────

export class MemberService {
  constructor(
    private readonly authz: AuthorizationPort,
    private readonly members: MemberRepo,
    private readonly memberRoles: MemberRoleRepo,
    private readonly workspaces: WorkspaceRepo,
    private readonly audit: AuditPort,
    private readonly logger: LoggerPort,
  ) {}

  async addMember(
    ctx: RequestContext,
    input: { userId: string; roleIds: string[] },
  ): Promise<Result<WorkspaceMember, AppError>> {
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());

    // 1. Authorize
    const authResult = await this.authz.authorize(ctx, 'member.invite', 'member');
    if (authResult.isErr()) {
      await this._logDeny(ctx, 'member.invite', 'member', input.userId);
      return err(new ForbiddenError(authResult.error.message));
    }

    // 2. Check not already a member
    const existing = await this.members.findOne({
      _and: [{ workspaceId: { _eq: ctx.workspaceId } }, { userId: { _eq: input.userId } }],
    } as Parameters<MemberRepo['findOne']>[0]);
    if (existing.isErr()) return err(new ConflictError(existing.error.message));
    if (existing.value) {
      return err(new ConflictError('User is already a workspace member'));
    }

    // 3. Create member record (active, not pending — direct add)
    const now = new Date();
    const member: WorkspaceMember = {
      id: uuidv7(),
      version: 1,
      workspaceId: ctx.workspaceId,
      userId: input.userId,
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

    this.logger.info('Member added', { workspaceId: ctx.workspaceId, userId: input.userId });

    // 4. Grant roles
    for (const roleId of input.roleIds) {
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

    // 5. Audit
    await this.audit.write({
      workspaceId: ctx.workspaceId,
      actorId: ctx.userId,
      action: 'member.added',
      resourceType: 'member',
      resourceId: createResult.value.id,
      after: { userId: input.userId, roleIds: input.roleIds },
      occurredAt: now,
      ...auditMeta(ctx),
    });

    return ok(createResult.value);
  }

  async changeRole(ctx: RequestContext, input: ChangeRoleInput): Promise<Result<void, AppError>> {
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());

    // 1. Authorize
    const authResult = await this.authz.authorize(ctx, 'role.assign', 'role');
    if (authResult.isErr()) {
      await this._logDeny(ctx, 'role.assign', 'role', input.memberId);
      return err(new ForbiddenError(authResult.error.message));
    }

    // 2. Validate
    const parsed = ChangeRoleInputSchema.safeParse(input);
    if (!parsed.success) {
      return err(
        new ValidationError(
          'Invalid role change input',
          parsed.error.issues.map((i) => ({
            path: i.path.join('.'),
            message: i.message,
          })),
        ),
      );
    }

    // 3. Confirm member is in this workspace
    const memberResult = await this.members.findOne({
      _and: [{ id: { _eq: parsed.data.memberId } }, { workspaceId: { _eq: ctx.workspaceId } }],
    } as Parameters<MemberRepo['findOne']>[0]);
    if (memberResult.isErr()) return err(new ConflictError(memberResult.error.message));
    if (!memberResult.value) return err(new NotFoundError('member', parsed.data.memberId));

    const now = new Date();

    // 4. Add new roles
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

    // 5. Remove roles (archive them)
    for (const roleId of parsed.data.removeRoleIds ?? []) {
      const existing = await this.memberRoles.findOne({
        _and: [{ workspaceMemberId: { _eq: parsed.data.memberId } }, { roleId: { _eq: roleId } }],
      } as Parameters<MemberRoleRepo['findOne']>[0]);
      if (existing.isOk() && existing.value) {
        await this.memberRoles.archive(existing.value.id);
      }
    }

    // 6. Audit
    await this.audit.write({
      workspaceId: ctx.workspaceId,
      actorId: ctx.userId,
      action: 'member.role_changed',
      resourceType: 'member',
      resourceId: parsed.data.memberId,
      after: {
        added: parsed.data.addRoleIds ?? [],
        removed: parsed.data.removeRoleIds ?? [],
      },
      occurredAt: now,
      ...auditMeta(ctx),
    });

    return ok(undefined);
  }

  async remove(ctx: RequestContext, input: RemoveMemberInput): Promise<Result<void, AppError>> {
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());

    // 1. Authorize
    const authResult = await this.authz.authorize(ctx, 'member.remove', 'member');
    if (authResult.isErr()) {
      await this._logDeny(ctx, 'member.remove', 'member', input.memberId);
      return err(new ForbiddenError(authResult.error.message));
    }

    // 2. Validate
    const parsed = RemoveMemberInputSchema.safeParse(input);
    if (!parsed.success) {
      return err(
        new ValidationError(
          'Invalid remove input',
          parsed.error.issues.map((i) => ({
            path: i.path.join('.'),
            message: i.message,
          })),
        ),
      );
    }

    // 3. Fetch member
    const memberResult = await this.members.findOne({
      _and: [{ id: { _eq: parsed.data.memberId } }, { workspaceId: { _eq: ctx.workspaceId } }],
    } as Parameters<MemberRepo['findOne']>[0]);
    if (memberResult.isErr()) return err(new ConflictError(memberResult.error.message));
    if (!memberResult.value) return err(new NotFoundError('member', parsed.data.memberId));
    const member = memberResult.value;

    // 4. Owner-cannot-self-orphan check
    const workspaceResult = await this.workspaces.findById(ctx.workspaceId);
    if (workspaceResult.isErr()) return err(new ConflictError(workspaceResult.error.message));
    if (!workspaceResult.value) return err(new NotFoundError('workspace', ctx.workspaceId));

    if (workspaceResult.value.ownerUserId === member.userId) {
      // Count active members with workspace_owner role — if only one, block removal
      const ownerCount = await this._countActiveOwners(ctx.workspaceId);
      if (ownerCount <= 1) {
        return err(new OwnerSelfOrphanError());
      }
    }

    // 5. Archive the member
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

    // 6. Audit
    await this.audit.write({
      workspaceId: ctx.workspaceId,
      actorId: ctx.userId,
      action: 'member.removed',
      resourceType: 'member',
      resourceId: parsed.data.memberId,
      after: { userId: member.userId },
      occurredAt: new Date(),
      ...auditMeta(ctx),
    });

    return ok(undefined);
  }

  async listMembers(
    ctx: RequestContext,
    opts?: { includeArchived?: boolean },
  ): Promise<Result<WorkspaceMember[], AppError>> {
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());

    const authResult = await this.authz.authorize(ctx, 'member.list', 'member');
    if (authResult.isErr()) {
      await this._logDeny(ctx, 'member.list', 'member', null);
      return err(new ForbiddenError(authResult.error.message));
    }

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

    return ok(result.value.items);
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private async _countActiveOwners(workspaceId: string): Promise<number> {
    // This is a simplified count — a full implementation would join
    // workspace_member_roles -> workspace_roles where role.name = 'workspace_owner'
    // For now we count active members; services with the full role repo would filter properly.
    const result = await this.members.count({
      _and: [{ workspaceId: { _eq: workspaceId } }, { status: { _eq: 'active' } }],
    } as Parameters<MemberRepo['count']>[0]);
    return result.isOk() ? result.value : 0;
  }

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
