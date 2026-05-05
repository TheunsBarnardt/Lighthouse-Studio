import type { AuditPort } from '@platform/ports-audit';
import type {
  AuthorizationPort,
  RequestContext,
  WorkspaceInvitation,
} from '@platform/ports-authorization';
import type { LoggerPort } from '@platform/ports-observability';
import type { RepositoryPort } from '@platform/ports-persistence';

import { err, ok, type Result } from 'neverthrow';
import { createHmac } from 'node:crypto';
import { z } from 'zod';

import type { AppError } from '../errors.js';

import { auditMeta, toAuditActor } from '../context.js';
import {
  ForbiddenError,
  InvitationAlreadyAcceptedError,
  InvitationExpiredError,
  NotFoundError,
  ValidationError,
} from '../errors.js';
import { observable } from '../observability/observable.js';

type InvitationRepo = RepositoryPort<WorkspaceInvitation>;

const TokenSchema = z.object({ token: z.string().min(1) });
const InvitationIdSchema = z.object({ invitationId: z.string().uuid() });

export class InvitationFlowService {
  readonly validateInvitation!: (
    ctx: RequestContext,
    token: string,
  ) => Promise<Result<WorkspaceInvitation, AppError>>;

  readonly acceptInvitation!: (
    ctx: RequestContext,
    token: string,
  ) => Promise<Result<{ workspaceId: string }, AppError>>;

  readonly resendInvitation!: (
    ctx: RequestContext,
    invitationId: string,
  ) => Promise<Result<void, AppError>>;

  readonly revokeInvitation!: (
    ctx: RequestContext,
    invitationId: string,
  ) => Promise<Result<void, AppError>>;

  constructor(
    private readonly authz: AuthorizationPort,
    private readonly invitations: InvitationRepo,
    private readonly audit: AuditPort,
    logger: LoggerPort,
  ) {
    const obs = { logger };
    const s = 'InvitationFlowService';
    this.validateInvitation = observable(
      s,
      'validateInvitation',
      obs,
      this._validateInvitation.bind(this),
    );
    this.acceptInvitation = observable(
      s,
      'acceptInvitation',
      obs,
      this._acceptInvitation.bind(this),
    );
    this.resendInvitation = observable(
      s,
      'resendInvitation',
      obs,
      this._resendInvitation.bind(this),
    );
    this.revokeInvitation = observable(
      s,
      'revokeInvitation',
      obs,
      this._revokeInvitation.bind(this),
    );
  }

  private async _validateInvitation(
    _ctx: RequestContext,
    token: string,
  ): Promise<Result<WorkspaceInvitation, AppError>> {
    const parsed = TokenSchema.safeParse({ token });
    if (!parsed.success) {
      return err(new ValidationError('Invalid invitation token'));
    }

    const result = await this.invitations.findOne({
      tokenHash: { _eq: this._hashToken(token) },
    } as Parameters<InvitationRepo['findOne']>[0]);
    if (result.isErr()) return err(new NotFoundError('invitation', token));

    const inv = result.value;
    if (!inv) return err(new NotFoundError('invitation', token));
    if (inv.acceptedAt !== null) return err(new InvitationAlreadyAcceptedError(inv.id));
    if (inv.expiresAt < new Date()) return err(new InvitationExpiredError(inv.id));

    return ok(inv);
  }

  private async _acceptInvitation(
    ctx: RequestContext,
    token: string,
  ): Promise<Result<{ workspaceId: string }, AppError>> {
    // 1. Validate token
    const invResult = await this._validateInvitation(ctx, token);
    if (invResult.isErr()) return err(invResult.error);
    const inv = invResult.value;

    // 2. Mark as accepted
    const updateResult = await this.invitations.update(
      inv.id,
      {
        acceptedAt: new Date(),
        acceptedByUserId: ctx.userId,
        updatedBy: ctx.userId,
        updatedAt: new Date(),
      } as Partial<WorkspaceInvitation>,
      { expectedVersion: inv.version },
    );
    if (updateResult.isErr()) return err(new NotFoundError('invitation', inv.id));

    // 3. Audit
    await this.audit.write({
      eventType: 'workspace.invitation.accepted',
      workspaceId: inv.workspaceId,
      actor: toAuditActor(ctx),
      resource: { type: 'invitation', id: inv.id },
      action: 'accepted',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: { invitedEmail: inv.email },
      ...auditMeta(ctx),
    });

    return ok({ workspaceId: inv.workspaceId });
  }

  private async _resendInvitation(
    ctx: RequestContext,
    invitationId: string,
  ): Promise<Result<void, AppError>> {
    const parsed = InvitationIdSchema.safeParse({ invitationId });
    if (!parsed.success) return err(new ValidationError('Invalid invitation ID'));

    // 1. Authorize
    const authResult = await this.authz.authorize(ctx, 'member.invite', 'member');
    if (authResult.isErr()) return err(new ForbiddenError(authResult.error.message));

    // 2. Verify it exists
    const inv = await this.invitations.findById(invitationId);
    if (inv.isErr() || !inv.value) return err(new NotFoundError('invitation', invitationId));

    // 3. Audit
    await this.audit.write({
      eventType: 'data_management.workspace.invitation_resent',
      workspaceId: ctx.workspaceId ?? inv.value.workspaceId,
      actor: toAuditActor(ctx),
      resource: { type: 'invitation', id: invitationId },
      action: 'invitation_resent',
      outcome: 'success',
      correlationId: ctx.correlationId,
      ...auditMeta(ctx),
    });

    return ok(undefined);
  }

  private async _revokeInvitation(
    ctx: RequestContext,
    invitationId: string,
  ): Promise<Result<void, AppError>> {
    const parsed = InvitationIdSchema.safeParse({ invitationId });
    if (!parsed.success) return err(new ValidationError('Invalid invitation ID'));

    // 1. Authorize
    const authResult = await this.authz.authorize(ctx, 'member.invite', 'member');
    if (authResult.isErr()) return err(new ForbiddenError(authResult.error.message));

    // 2. Execute
    const inv = await this.invitations.findById(invitationId);
    if (inv.isErr() || !inv.value) return err(new NotFoundError('invitation', invitationId));

    await this.invitations.archive(invitationId);

    return ok(undefined);
  }

  private _hashToken(token: string): string {
    // eslint-disable-next-line no-restricted-syntax
    const secret =
      process.env['PLATFORM_INVITATION_SECRET'] ?? 'dev-placeholder-must-be-overridden';
    return createHmac('sha256', secret).update(token).digest('hex');
  }
}
