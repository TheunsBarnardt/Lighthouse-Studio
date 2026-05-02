export type AuditErrorCode = 'WRITE_FAILED' | 'QUERY_FAILED' | 'UNKNOWN';

export class AuditError extends Error {
  readonly code: AuditErrorCode;
  override readonly cause?: unknown;
  constructor(code: AuditErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'AuditError';
    this.code = code;
    this.cause = cause;
  }
}
