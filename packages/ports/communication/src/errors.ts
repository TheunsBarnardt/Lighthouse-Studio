export type CommunicationErrorCode =
  | 'DELIVERY_FAILED'
  | 'INVALID_ADDRESS'
  | 'RATE_LIMITED'
  | 'NOT_SUPPORTED'
  | 'PROVIDER_ERROR'
  | 'UNKNOWN';

export class CommunicationError extends Error {
  readonly code: CommunicationErrorCode;
  override readonly cause?: unknown;
  constructor(code: CommunicationErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'CommunicationError';
    this.code = code;
    this.cause = cause;
  }
}
