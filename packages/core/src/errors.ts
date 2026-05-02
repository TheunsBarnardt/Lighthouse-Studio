// ── AppError — base for all domain errors ─────────────────────────────────────

export type AppErrorKind =
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'FORBIDDEN'
  | 'WORKSPACE_CONTEXT_REQUIRED'
  | 'INVITATION_EXPIRED'
  | 'INVITATION_ALREADY_ACCEPTED'
  | 'OWNER_SELF_ORPHAN'
  | 'APPROVAL_ALREADY_RESOLVED'
  | 'UNKNOWN';

export class AppError extends Error {
  readonly kind: AppErrorKind;

  constructor(
    kind: AppErrorKind,
    message: string,
    override readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
    this.kind = kind;
  }
}

export class ValidationError extends AppError {
  constructor(
    message: string,
    readonly issues?: Array<{ path: string; message: string }>,
  ) {
    super('VALIDATION', message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super('NOT_FOUND', `${resource} not found: ${id}`);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super('CONFLICT', message);
    this.name = 'ConflictError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string) {
    super('FORBIDDEN', message);
    this.name = 'ForbiddenError';
  }
}

export class WorkspaceContextRequiredError extends AppError {
  constructor() {
    super('WORKSPACE_CONTEXT_REQUIRED', 'A workspace context is required for this operation');
    this.name = 'WorkspaceContextRequiredError';
  }
}

export class InvitationExpiredError extends AppError {
  constructor(invitationId: string) {
    super('INVITATION_EXPIRED', `Invitation ${invitationId} has expired`);
    this.name = 'InvitationExpiredError';
  }
}

export class InvitationAlreadyAcceptedError extends AppError {
  constructor(invitationId: string) {
    super('INVITATION_ALREADY_ACCEPTED', `Invitation ${invitationId} has already been accepted`);
    this.name = 'InvitationAlreadyAcceptedError';
  }
}

export class OwnerSelfOrphanError extends AppError {
  constructor() {
    super(
      'OWNER_SELF_ORPHAN',
      'Cannot remove the last owner of a workspace. Assign another owner first.',
    );
    this.name = 'OwnerSelfOrphanError';
  }
}

export class ApprovalAlreadyResolvedError extends AppError {
  constructor(approvalId: string) {
    super('APPROVAL_ALREADY_RESOLVED', `Approval ${approvalId} has already been resolved`);
    this.name = 'ApprovalAlreadyResolvedError';
  }
}
