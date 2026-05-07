export type ErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'VERSION_MISMATCH'
  | 'VALIDATION_ERROR'
  | 'RATE_LIMITED'
  | 'SERVER_ERROR'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'IDEMPOTENCY_CONFLICT'
  | 'SCHEMA_MISMATCH'
  | 'WORKSPACE_NOT_FOUND'
  | 'QUOTA_EXCEEDED';

export interface PlatformErrorOptions {
  message: string;
  code: ErrorCode;
  correlationId?: string | undefined;
  status?: number | undefined;
  details?: unknown;
}

export class PlatformError extends Error {
  readonly code: ErrorCode;
  readonly correlationId: string | undefined;
  readonly status: number | undefined;
  readonly details: unknown;

  constructor(opts: PlatformErrorOptions) {
    super(opts.message);
    this.name = 'PlatformError';
    this.code = opts.code;
    this.correlationId = opts.correlationId;
    this.status = opts.status;
    this.details = opts.details;
  }
}

export class UnauthorizedError extends PlatformError {
  constructor(message = 'Not authenticated', correlationId?: string) {
    super({ message, code: 'UNAUTHORIZED', status: 401, correlationId });
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends PlatformError {
  constructor(message = 'Access denied', correlationId?: string) {
    super({ message, code: 'FORBIDDEN', status: 403, correlationId });
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends PlatformError {
  constructor(message = 'Resource not found', correlationId?: string) {
    super({ message, code: 'NOT_FOUND', status: 404, correlationId });
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends PlatformError {
  constructor(message = 'Conflict', correlationId?: string, details?: unknown) {
    super({ message, code: 'CONFLICT', status: 409, correlationId, details });
    this.name = 'ConflictError';
  }
}

export class ValidationError extends PlatformError {
  constructor(message: string, correlationId?: string, details?: unknown) {
    super({ message, code: 'VALIDATION_ERROR', status: 422, correlationId, details });
    this.name = 'ValidationError';
  }
}

export class RateLimitedError extends PlatformError {
  readonly retryAfter: number | undefined;
  constructor(message = 'Rate limited', correlationId?: string, retryAfter?: number) {
    super({ message, code: 'RATE_LIMITED', status: 429, correlationId });
    this.name = 'RateLimitedError';
    this.retryAfter = retryAfter;
  }
}

export class ServerError extends PlatformError {
  constructor(message = 'Server error', correlationId?: string) {
    super({ message, code: 'SERVER_ERROR', status: 500, correlationId });
    this.name = 'ServerError';
  }
}

export class NetworkError extends PlatformError {
  constructor(message = 'Network error', cause?: Error) {
    super({ message, code: 'NETWORK_ERROR', details: cause?.message });
    this.name = 'NetworkError';
    if (cause) this.cause = cause;
  }
}

export class TimeoutError extends PlatformError {
  constructor(message = 'Request timed out') {
    super({ message, code: 'TIMEOUT' });
    this.name = 'TimeoutError';
  }
}

export class QuotaExceededError extends PlatformError {
  constructor(message = 'Quota exceeded', correlationId?: string) {
    super({ message, code: 'QUOTA_EXCEEDED', status: 402, correlationId });
    this.name = 'QuotaExceededError';
  }
}

/** Parse an API error response body (RFC 7807 problem detail) into a PlatformError. */
export function parseApiError(
  body: unknown,
  status: number,
  correlationId?: string,
): PlatformError {
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>;
    const message =
      typeof b['title'] === 'string'
        ? b['title']
        : typeof b['message'] === 'string'
          ? b['message']
          : 'Request failed';
    const details = b['errors'] ?? b['detail'];

    switch (status) {
      case 400:
        return new ValidationError(message, correlationId, details);
      case 401:
        return new UnauthorizedError(message, correlationId);
      case 403:
        return new ForbiddenError(message, correlationId);
      case 404:
        return new NotFoundError(message, correlationId);
      case 409: {
        // Prefer the body's code (e.g. VERSION_MISMATCH) over the generic CONFLICT code
        const bodyCode = typeof b['code'] === 'string' ? b['code'] : undefined;
        if (bodyCode && bodyCode !== 'CONFLICT') {
          return new PlatformError({
            message,
            code: bodyCode as ErrorCode,
            status: 409,
            correlationId,
            details,
          });
        }
        return new ConflictError(message, correlationId, details);
      }
      case 422:
        return new ValidationError(message, correlationId, details);
      case 429: {
        const retryAfter = typeof b['retryAfter'] === 'number' ? b['retryAfter'] : undefined;
        return new RateLimitedError(message, correlationId, retryAfter);
      }
      case 402:
        return new QuotaExceededError(message, correlationId);
    }
  }

  if (status >= 500) return new ServerError('Server error', correlationId);
  return new PlatformError({
    message: 'Request failed',
    code: 'SERVER_ERROR',
    status,
    correlationId,
  });
}
