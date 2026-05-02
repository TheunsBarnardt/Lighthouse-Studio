import type { AuditPort } from '@platform/ports-audit';
import type {
  AuthorizationPort,
  RequestContext,
  WorkspaceInvitation,
  WorkspaceMember,
  WorkspaceMemberRole,
} from '@platform/ports-authorization';
import type { LoggerPort } from '@platform/ports-observability';
import type { RepositoryPort } from '@platform/ports-persistence';

import { err, ok, type Result } from 'neverthrow';
import { createHmac, randomBytes } from 'node:crypto';
import { uuidv7 } from 'uuidv7';
import { z } from 'zod';

import type { AppError } from '../errors.js';

import { auditMeta } from '../context.js';
import {
  ConflictError,
  ForbiddenError,
  InvitationAlreadyAcceptedError,
  InvitationExpiredError,
  NotFoundError,
  ValidationError,
  WorkspaceContextRequiredError,
} from '../errors.js';

// ── Input schemas ──────────────────────────────────────────────────────────────

const CreateInvitationInputSchema = z.object({
  email: z.string().email(),
  roleIds: z.array(z.string().uuid()).min(1),
  ttlHours: z.number().int().min(1).max(168).default(72),
});

export type CreateInvitationInput = z.infer<typeof CreateInvitationInputSchema>;

type InvitationRepo = RepositoryPort<WorkspaceInvitation>;
type MemberRepo = RepositoryPort<WorkspaceMember>;
type MemberRoleRepo = RepositoryPort<WorkspaceMemberRole>;

const TOKEN_BYTE_LENGTH = 32;
const HMAC_SECRET_ENV = 'PLATFORM_INVITATION_SECRET';

function generateInvitationToken(): string {
  return randomBytes(TOKEN_BYTE_LENGTH).toString('hex');
}

function hashToken(token: string): string {
  // eslint-disable-next-line no-restricted-syntax
  const secret = process.env[HMAC_SECRET_ENV] ?? 'dev-placeholder-must-be-overridden';
  return createHmac('sha256', secret).update(token).digest('hex');
}

// ── Service ───────────────────────────────────────────────────────────────────

export class InvitationService {
  constructor(
    private readonly authz: AuthorizationPort,
    private readonly invitations: InvitationRepo,
    private readonly members: MemberRepo,
    private readonly memberRoles: MemberRoleRepo,
    private readonly audit: AuditPort,
    private readonly logger: LoggerPort,
  ) {}

  async create(
    ctx: RequestContext,
    input: CreateInvitationInput,
  ): Promise<Result<{ invitation: WorkspaceInvitation; token: string }, AppError>> {
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());

    // 1. Authorize
    const authResult = await this.authz.authorize(ctx, 'invitation.create', 'invitation');
    if (authResult.isErr()) {
      await this._logDeny(ctx, 'invitation.create', 'invitation', null);
      return err(new ForbiddenError(authResult.error.message));
    }

    // 2. Validate
    const parsed = CreateInvitationInputSchema.safeParse(input);
    if (!parsed.success) {
      return err(
        new ValidationError(
          'Invalid invitation input',
          parsed.error.issues.map((i) => ({
            path: i.path.join('.'),
            message: i.message,
          })),
        ),
      );
    }

    // 3. Check for existing pending invitation for this email in this workspace
    const existing = await this.invitations.findOne({
      _and: [{ workspaceId: { _eq: ctx.workspaceId } }, { email: { _eq: parsed.data.email } }],
    } as Parameters<InvitationRepo['findOne']>[0]);
    if (existing.isErr()) return err(new ConflictError(existing.error.message));
    if (existing.value && !existing.value.acceptedAt) {
      return err(new ConflictError(`A pending invitation already exists for ${parsed.data.email}`));
    }

    // 4. Generate token and create invitation
    const token = generateInvitationToken();
    const tokenHash = hashToken(token);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + parsed.data.ttlHours * 60 * 60 * 1000);

    const invitation: WorkspaceInvitation = {
      id: uuidv7(),
      version: 1,
      workspaceId: ctx.workspaceId,
      email: parsed.data.email,
      invitedByUserId: ctx.userId,
      initialRoles: parsed.data.roleIds,
      tokenHash,
      expiresAt,
      acceptedAt: null,
      acceptedByUserId: null,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    };

    const createResult = await this.invitations.create(invitation);
    if (createResult.isErr()) return err(new ConflictError(createResult.error.message));

    // 5. Audit
    await this.audit.write({
      workspaceId: ctx.workspaceId,
      actorId: ctx.userId,
      action: 'invitation.created',
      resourceType: 'invitation',
      resourceId: createResult.value.id,
      after: { email: parsed.data.email, expiresAt: expiresAt.toISOString() },
      occurredAt: now,
      ...auditMeta(ctx),
    });

    this.logger.info('Workspace invitation created', {
      workspaceId: ctx.workspaceId,
      invitationId: createResult.value.id,
      email: parsed.data.email,
    });

    return ok({ invitation: createResult.value, token });
  }

  async accept(ctx: RequestContext, token: string): Promise<Result<WorkspaceMember, AppError>> {
    // 1. Look up by token hash
    const tokenHash = hashToken(token);
    const invResult = await this.invitations.findOne({
      tokenHash: { _eq: tokenHash },
    } as Parameters<InvitationRepo['findOne']>[0]);
    if (invResult.isErr()) return err(new ConflictError(invResult.error.message));
    if (!invResult.value) return err(new NotFoundError('invitation', tokenHash));

    const invitation = invResult.value;

    // 2. Check not already accepted
    if (invitation.acceptedAt) {
      return err(new InvitationAlreadyAcceptedError(invitation.id));
    }

    // 3. Check not expired
    if (new Date() > invitation.expiresAt) {
      return err(new InvitationExpiredError(invitation.id));
    }

    // 4. Create member as active
    const now = new Date();
    const member: WorkspaceMember = {
      id: uuidv7(),
      version: 1,
      workspaceId: invitation.workspaceId,
      userId: ctx.userId,
      status: 'active',
      invitedAt: invitation.createdAt,
      acceptedAt: now,
      invitedByUserId: invitation.invitedByUserId,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    };

    const memberResult = await this.members.create(member);
    if (memberResult.isErr()) return err(new ConflictError(memberResult.error.message));

    // 5. Grant initial roles
    for (const roleId of invitation.initialRoles) {
      const roleGrant: WorkspaceMemberRole = {
        id: uuidv7(),
        version: 1,
        workspaceMemberId: memberResult.value.id,
        roleId,
        grantedByUserId: invitation.invitedByUserId,
        archivedAt: null,
        createdAt: now,
        updatedAt: now,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      };
      await this.memberRoles.create(roleGrant);
    }

    // 6. Mark invitation accepted
    await this.invitations.update(invitation.id, {
      acceptedAt: now,
      acceptedByUserId: ctx.userId,
      updatedBy: ctx.userId,
      updatedAt: now,
    });

    // 7. Audit
    await this.audit.write({
      workspaceId: invitation.workspaceId,
      actorId: ctx.userId,
      action: 'invitation.accepted',
      resourceType: 'invitation',
      resourceId: invitation.id,
      after: { memberId: memberResult.value.id, userId: ctx.userId },
      occurredAt: now,
      ...auditMeta(ctx),
    });

    return ok(memberResult.value);
  }

  async revoke(ctx: RequestContext, invitationId: string): Promise<Result<void, AppError>> {
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());

    const authResult = await this.authz.authorize(ctx, 'invitation.revoke', 'invitation');
    if (authResult.isErr()) {
      await this._logDeny(ctx, 'invitation.revoke', 'invitation', invitationId);
      return err(new ForbiddenError(authResult.error.message));
    }

    const invResult = await this.invitations.findOne({
      _and: [{ id: { _eq: invitationId } }, { workspaceId: { _eq: ctx.workspaceId } }],
    } as Parameters<InvitationRepo['findOne']>[0]);
    if (invResult.isErr()) return err(new ConflictError(invResult.error.message));
    if (!invResult.value) return err(new NotFoundError('invitation', invitationId));

    const archiveResult = await this.invitations.archive(invitationId);
    if (archiveResult.isErr()) return err(new NotFoundError('invitation', invitationId));

    await this.audit.write({
      workspaceId: ctx.workspaceId,
      actorId: ctx.userId,
      action: 'invitation.revoked',
      resourceType: 'invitation',
      resourceId: invitationId,
      occurredAt: new Date(),
      ...auditMeta(ctx),
    });

    return ok(undefined);
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
