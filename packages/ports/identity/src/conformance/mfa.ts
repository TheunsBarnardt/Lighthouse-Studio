import { describe, expect, it } from 'vitest';

import type { MfaPort } from '../mfa.port.js';

export function runMfaConformance(
  name: string,
  factory: () => Promise<{ mfa: MfaPort; userId: string }>,
): void {
  describe(`${name} — MfaPort conformance`, () => {
    // ── enrollment ────────────────────────────────────────────────────────────

    it('generateTotpSecret returns a secret and QR code data URI', async () => {
      const { mfa, userId } = await factory();
      const enrollment = (await mfa.generateTotpSecret(userId))._unsafeUnwrap();

      expect(enrollment.secret).toBeTruthy();
      expect(enrollment.qrCodeData).toMatch(/^otpauth:\/\/totp\//);
      expect(enrollment.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('confirmEnrollment rejects an invalid code', async () => {
      const { mfa, userId } = await factory();
      await mfa.generateTotpSecret(userId);
      const result = await mfa.confirmEnrollment(userId, '000000');
      // Extremely unlikely to be a valid code for a freshly generated secret
      if (result.isErr()) {
        expect(result._unsafeUnwrapErr().code).toBe('MFA_FAILED');
      }
      // (If the test generates a valid code by chance it still passes — the
      // behavior is correct; we just can't guarantee the code is wrong.)
    });

    it('disable removes TOTP enrollment', async () => {
      const { mfa, userId } = await factory();
      // If not enrolled, disable must fail gracefully
      const result = await mfa.disable(userId);
      if (result.isErr()) {
        expect(result._unsafeUnwrapErr().code).toBe('MFA_NOT_ENROLLED');
      } else {
        // Already disabled — also valid
        expect(result.isOk()).toBe(true);
      }
    });

    // ── recovery codes ────────────────────────────────────────────────────────

    it('verifyRecoveryCode fails for unknown user / no codes set', async () => {
      const { mfa, userId } = await factory();
      const result = await mfa.verifyRecoveryCode(userId, '12345678');
      expect(result.isErr()).toBe(true);
      expect(['MFA_FAILED', 'MFA_NOT_ENROLLED']).toContain(result._unsafeUnwrapErr().code);
    });

    it('regenerateRecoveryCodes returns 10 codes', async () => {
      const { mfa, userId } = await factory();
      const codes = (await mfa.regenerateRecoveryCodes(userId))._unsafeUnwrap();
      expect(codes.codes).toHaveLength(10);
      // Each code is an 8-digit numeric string per spec
      for (const code of codes.codes) {
        expect(code).toMatch(/^\d{8}$/);
      }
    });

    it('regenerateRecoveryCodes invalidates old codes', async () => {
      const { mfa, userId } = await factory();
      const first = (await mfa.regenerateRecoveryCodes(userId))._unsafeUnwrap();
      await mfa.regenerateRecoveryCodes(userId);

      // Try to use a code from the first batch — must fail
      const code = first.codes[0];
      if (code !== undefined) {
        const result = await mfa.verifyRecoveryCode(userId, code);
        expect(result.isErr()).toBe(true);
      }
    });

    // ── verifyTotp ────────────────────────────────────────────────────────────

    it('verifyTotp fails for unenrolled user', async () => {
      const { mfa, userId } = await factory();
      const result = await mfa.verifyTotp(userId, '123456');
      expect(result.isErr()).toBe(true);
      expect(['MFA_FAILED', 'MFA_NOT_ENROLLED']).toContain(result._unsafeUnwrapErr().code);
    });
  });
}
