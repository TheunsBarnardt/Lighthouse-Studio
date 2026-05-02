export type ObservabilityErrorCode = 'BACKEND_UNAVAILABLE' | 'UNKNOWN';

export class ObservabilityError extends Error {
  readonly code: ObservabilityErrorCode;
  override readonly cause?: unknown;
  constructor(code: ObservabilityErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'ObservabilityError';
    this.code = code;
    this.cause = cause;
  }
}
