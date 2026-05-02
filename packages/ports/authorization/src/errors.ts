export type AuthorizationErrorKind =
  | 'FORBIDDEN'
  | 'WORKSPACE_CONTEXT_REQUIRED'
  | 'INSTALLATION_ROLE_REQUIRED'
  | 'UNKNOWN';

export class AuthorizationError extends Error {
  readonly kind: AuthorizationErrorKind;

  constructor(
    kind: AuthorizationErrorKind,
    message: string,
    override readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'AuthorizationError';
    this.kind = kind;
  }
}
