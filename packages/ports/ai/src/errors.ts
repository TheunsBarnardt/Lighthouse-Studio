export type AiErrorCode =
  | 'RATE_LIMITED'
  | 'CONTEXT_EXCEEDED'
  | 'PROVIDER_ERROR'
  | 'CONTENT_FILTERED'
  | 'TIMEOUT'
  | 'UNKNOWN';

export class AiError extends Error {
  readonly code: AiErrorCode;
  override readonly cause?: unknown;
  constructor(code: AiErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'AiError';
    this.code = code;
    this.cause = cause;
  }
}
