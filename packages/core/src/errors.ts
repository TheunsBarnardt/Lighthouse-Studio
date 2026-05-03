// ── AppError — base for all domain errors ─────────────────────────────────────

export type AppErrorCode =
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'FORBIDDEN'
  | 'AUTHENTICATION'
  | 'AUTHORIZATION'
  | 'RATE_LIMIT'
  | 'EXTERNAL_SERVICE'
  | 'TIMEOUT'
  | 'NOT_SUPPORTED'
  | 'WORKSPACE_CONTEXT_REQUIRED'
  | 'INVITATION_EXPIRED'
  | 'INVITATION_ALREADY_ACCEPTED'
  | 'OWNER_SELF_ORPHAN'
  | 'APPROVAL_ALREADY_RESOLVED'
  | 'INTERNAL'
  | 'UNKNOWN';

/** @deprecated Use AppErrorCode */
export type AppErrorKind = AppErrorCode;

export abstract class AppError extends Error {
  abstract readonly code: AppErrorCode;
  abstract readonly statusCode: number;
  override readonly cause?: unknown;
  readonly metadata: Readonly<Record<string, unknown>>;

  constructor(message: string, opts?: { cause?: unknown; metadata?: Record<string, unknown> }) {
    super(message);
    this.name = this.constructor.name;
    this.cause = opts?.cause;
    this.metadata = Object.freeze(opts?.metadata ?? {});
  }

  /** @deprecated Use code */
  get kind(): AppErrorCode {
    return this.code;
  }
}

export class ValidationError extends AppError {
  readonly code = 'VALIDATION' as const;
  readonly statusCode = 400;

  constructor(
    message: string,
    readonly issues?: Array<{ path: string; message: string }>,
    opts?: { cause?: unknown },
  ) {
    super(message, {
      cause: opts?.cause,
      ...(issues ? { metadata: { issues } as Record<string, unknown> } : {}),
    });
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends AppError {
  readonly code = 'AUTHENTICATION' as const;
  readonly statusCode = 401;

  constructor(message: string, opts?: { cause?: unknown }) {
    super(message, opts);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends AppError {
  readonly code = 'AUTHORIZATION' as const;
  readonly statusCode = 403;

  constructor(message: string, opts?: { cause?: unknown }) {
    super(message, opts);
    this.name = 'AuthorizationError';
  }
}

export class ForbiddenError extends AppError {
  readonly code = 'FORBIDDEN' as const;
  readonly statusCode = 403;

  constructor(message: string, opts?: { cause?: unknown }) {
    super(message, opts);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends AppError {
  readonly code = 'NOT_FOUND' as const;
  readonly statusCode = 404;

  constructor(
    public readonly resourceType: string,
    public readonly resourceId: string,
  ) {
    super(`${resourceType} not found: ${resourceId}`);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  readonly code = 'CONFLICT' as const;
  readonly statusCode = 409;

  constructor(message: string, opts?: { cause?: unknown }) {
    super(message, opts);
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends AppError {
  readonly code = 'RATE_LIMIT' as const;
  readonly statusCode = 429;

  constructor(
    message: string,
    readonly retryAfterMs?: number,
  ) {
    super(message, {
      ...(retryAfterMs != null ? { metadata: { retryAfterMs } as Record<string, unknown> } : {}),
    });
    this.name = 'RateLimitError';
  }
}

export class ExternalServiceError extends AppError {
  readonly code = 'EXTERNAL_SERVICE' as const;
  readonly statusCode = 502;

  constructor(
    public readonly service: string,
    message: string,
    opts?: { cause?: unknown },
  ) {
    super(`${service}: ${message}`, opts);
    this.name = 'ExternalServiceError';
  }
}

export class TimeoutError extends AppError {
  readonly code = 'TIMEOUT' as const;
  readonly statusCode = 504;

  constructor(message: string, opts?: { cause?: unknown }) {
    super(message, opts);
    this.name = 'TimeoutError';
  }
}

export class NotSupportedError extends AppError {
  readonly code = 'NOT_SUPPORTED' as const;
  readonly statusCode = 501;

  constructor(message: string) {
    super(message);
    this.name = 'NotSupportedError';
  }
}

export class InternalError extends AppError {
  readonly code = 'INTERNAL' as const;
  readonly statusCode = 500;

  constructor(message: string, opts?: { cause?: unknown }) {
    super(message, opts);
    this.name = 'InternalError';
  }
}

export class WorkspaceContextRequiredError extends AppError {
  readonly code = 'WORKSPACE_CONTEXT_REQUIRED' as const;
  readonly statusCode = 400;

  constructor() {
    super('A workspace context is required for this operation');
    this.name = 'WorkspaceContextRequiredError';
  }
}

export class InvitationExpiredError extends AppError {
  readonly code = 'INVITATION_EXPIRED' as const;
  readonly statusCode = 410;

  constructor(invitationId: string) {
    super(`Invitation ${invitationId} has expired`);
    this.name = 'InvitationExpiredError';
  }
}

export class InvitationAlreadyAcceptedError extends AppError {
  readonly code = 'INVITATION_ALREADY_ACCEPTED' as const;
  readonly statusCode = 409;

  constructor(invitationId: string) {
    super(`Invitation ${invitationId} has already been accepted`);
    this.name = 'InvitationAlreadyAcceptedError';
  }
}

export class OwnerSelfOrphanError extends AppError {
  readonly code = 'OWNER_SELF_ORPHAN' as const;
  readonly statusCode = 409;

  constructor() {
    super('Cannot remove the last owner of a workspace. Assign another owner first.');
    this.name = 'OwnerSelfOrphanError';
  }
}

export class ApprovalAlreadyResolvedError extends AppError {
  readonly code = 'APPROVAL_ALREADY_RESOLVED' as const;
  readonly statusCode = 409;

  constructor(approvalId: string) {
    super(`Approval ${approvalId} has already been resolved`);
    this.name = 'ApprovalAlreadyResolvedError';
  }
}
