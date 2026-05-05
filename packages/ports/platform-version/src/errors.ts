export type PlatformVersionErrorCode =
  | 'NOT_FOUND'
  | 'RECORD_FAILED'
  | 'ROLLBACK_FAILED'
  | 'NOTHING_TO_ROLLBACK'
  | 'QUERY_FAILED';

export class PlatformVersionError extends Error {
  readonly code: PlatformVersionErrorCode;
  override readonly cause?: unknown;

  constructor(code: PlatformVersionErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'PlatformVersionError';
    this.code = code;
    this.cause = cause;
  }
}
