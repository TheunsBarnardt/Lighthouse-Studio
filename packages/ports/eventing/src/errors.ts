export type EventingErrorCode =
  | 'PUBLISH_FAILED'
  | 'SUBSCRIBE_FAILED'
  | 'SERIALIZATION_ERROR'
  | 'PROVIDER_ERROR'
  | 'UNKNOWN';

export class EventingError extends Error {
  readonly code: EventingErrorCode;
  override readonly cause?: unknown;
  constructor(code: EventingErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'EventingError';
    this.code = code;
    this.cause = cause;
  }
}
