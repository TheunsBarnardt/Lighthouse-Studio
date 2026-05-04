export type RateLimitErrorKind = 'RATE_LIMITED' | 'BACKEND_FAILURE' | 'UNKNOWN';

export class RateLimitError extends Error {
  readonly kind: RateLimitErrorKind;
  readonly retryAfterMs?: number;
  override readonly cause?: unknown;

  constructor(
    kind: RateLimitErrorKind,
    message: string,
    opts?: { retryAfterMs?: number; cause?: unknown },
  ) {
    super(message);
    this.name = 'RateLimitError';
    this.kind = kind;
    if (opts?.retryAfterMs !== undefined) {
      this.retryAfterMs = opts.retryAfterMs;
    }
    this.cause = opts?.cause;
  }
}
