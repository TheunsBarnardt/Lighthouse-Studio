import { describe, expect, it } from 'vitest';

import type { IdentityProviderPort } from '../identity-provider.port.js';

export function runIdentityProviderConformance(
  name: string,
  factory: () => Promise<IdentityProviderPort>,
): void {
  describe(`${name} — IdentityProviderPort conformance`, () => {
    it('verifyToken rejects an invalid token', async () => {
      const provider = await factory();
      const result = await provider.verifyToken('invalid.token.here');
      expect(result.isErr()).toBe(true);
      const err = result._unsafeUnwrapErr();
      expect(['TOKEN_INVALID', 'TOKEN_EXPIRED', 'UNKNOWN']).toContain(err.code);
    });

    it('signOut succeeds or fails gracefully on an invalid token', async () => {
      const provider = await factory();
      const result = await provider.signOut('invalid-token');
      // Either ok (idempotent) or typed error — never throws
      expect(result.isOk() || result.isErr()).toBe(true);
    });

    it('supports returns a boolean for any feature string', async () => {
      const provider = await factory();
      const result = provider.supports('password');
      expect(typeof result).toBe('boolean');
    });
  });
}
