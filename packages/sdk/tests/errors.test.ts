import { describe, it, expect } from 'vitest';

import {
  PlatformError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
  RateLimitedError,
  ServerError,
  NetworkError,
  TimeoutError,
  parseApiError,
} from '../src/errors/index.js';

describe('Error hierarchy', () => {
  it('all error subclasses extend PlatformError', () => {
    expect(new UnauthorizedError()).toBeInstanceOf(PlatformError);
    expect(new ForbiddenError()).toBeInstanceOf(PlatformError);
    expect(new NotFoundError()).toBeInstanceOf(PlatformError);
    expect(new ConflictError()).toBeInstanceOf(PlatformError);
    expect(new ValidationError('x')).toBeInstanceOf(PlatformError);
    expect(new RateLimitedError()).toBeInstanceOf(PlatformError);
    expect(new ServerError()).toBeInstanceOf(PlatformError);
    expect(new NetworkError()).toBeInstanceOf(PlatformError);
    expect(new TimeoutError()).toBeInstanceOf(PlatformError);
  });

  it('UnauthorizedError has code UNAUTHORIZED and status 401', () => {
    const e = new UnauthorizedError();
    expect(e.code).toBe('UNAUTHORIZED');
    expect(e.status).toBe(401);
  });

  it('error exposes correlationId', () => {
    const e = new NotFoundError('not found', 'corr-abc');
    expect(e.correlationId).toBe('corr-abc');
  });

  it('RateLimitedError carries retryAfter', () => {
    const e = new RateLimitedError('Rate limited', undefined, 30);
    expect(e.retryAfter).toBe(30);
  });
});

describe('parseApiError', () => {
  it('maps 401 to UnauthorizedError', () => {
    const e = parseApiError({ title: 'Unauthorized' }, 401, 'corr-1');
    expect(e).toBeInstanceOf(UnauthorizedError);
    expect(e.correlationId).toBe('corr-1');
  });

  it('maps 404 to NotFoundError', () => {
    expect(parseApiError({ title: 'Not found' }, 404)).toBeInstanceOf(NotFoundError);
  });

  it('maps 422 to ValidationError', () => {
    const e = parseApiError({ title: 'Validation failed', errors: [{ field: 'email' }] }, 422);
    expect(e).toBeInstanceOf(ValidationError);
    expect(e.details).toEqual([{ field: 'email' }]);
  });

  it('maps 429 to RateLimitedError with retryAfter', () => {
    const e = parseApiError({ title: 'Rate limited', retryAfter: 10 }, 429) as RateLimitedError;
    expect(e).toBeInstanceOf(RateLimitedError);
    expect(e.retryAfter).toBe(10);
  });

  it('maps 500+ to ServerError', () => {
    expect(parseApiError(null, 500)).toBeInstanceOf(ServerError);
    expect(parseApiError(null, 503)).toBeInstanceOf(ServerError);
  });
});
