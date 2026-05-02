export type JobErrorCode =
  | 'JOB_NOT_FOUND'
  | 'QUEUE_UNAVAILABLE'
  | 'ENQUEUE_FAILED'
  | 'SCHEDULE_CONFLICT'
  | 'UNKNOWN';

export class JobError extends Error {
  readonly code: JobErrorCode;
  override readonly cause?: unknown;
  constructor(code: JobErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'JobError';
    this.code = code;
    this.cause = cause;
  }
}
