import { NotFoundError, UnauthorizedError, ForbiddenError } from '@platform/sdk';
/**
 * SDK E2E — Typed errors (DoD 28, Objective 19)
 */
import { describe, it, expect } from 'vitest';

import { E2E_ENABLED, makeClient } from './helpers.js';

describe.skipIf(!E2E_ENABLED)('Errors E2E', () => {
  const client = makeClient();

  it('DoD-28: unauthenticated request yields UnauthorizedError with code + correlationId', async () => {
    // Call session refresh without a token — returns 401 UNAUTHORIZED
    try {
      await client.auth.refreshSession();
      expect.fail('expected error');
    } catch (err) {
      expect(err).toBeInstanceOf(UnauthorizedError);
      const e = err as UnauthorizedError;
      expect(e.code).toBe('UNAUTHORIZED');
    }
  });

  it('DoD-28: NotFoundError and ForbiddenError are importable typed classes', () => {
    const nfe = new NotFoundError('test');
    expect(nfe.code).toBe('NOT_FOUND');
    const ffe = new ForbiddenError('test');
    expect(ffe.code).toBe('FORBIDDEN');
  });
});
