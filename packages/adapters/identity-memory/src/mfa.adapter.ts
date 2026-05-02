import type {
  MfaPort,
  RecoveryCodes,
  TotpEnrollment,
  UserDirectoryPort,
} from '@platform/ports-identity';
import type { Result } from 'neverthrow';

import { IdentityError } from '@platform/ports-identity';
import { err, ok } from 'neverthrow';

const ENROLLMENT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const CODE_LENGTH = 8;
const CODE_COUNT = 10;
const TOTP_PERIOD = 30;

function generateNumericCode(length: number): string {
  const max = Math.pow(10, length);
  return String(Math.floor(Math.random() * max)).padStart(length, '0');
}

function currentTotpWindow(): number {
  return Math.floor(Date.now() / 1000 / TOTP_PERIOD);
}

function totpCode(secret: string, window: number): string {
  // Simplified TOTP for in-memory testing only.
  // Real implementation in identity-builtin uses otpauth.
  let h = 0;
  for (let i = 0; i < secret.length; i++) {
    h = (Math.imul(31, h) + secret.charCodeAt(i) + window) | 0;
  }
  return String(Math.abs(h) % 1_000_000).padStart(6, '0');
}

interface PendingEnrollment {
  secret: string;
  expiresAt: Date;
}

export class InMemoryMfaAdapter implements MfaPort {
  private readonly pending = new Map<string, PendingEnrollment>();

  constructor(private readonly userDirectory: UserDirectoryPort) {}

  generateTotpSecret(userId: string): Promise<Result<TotpEnrollment, IdentityError>> {
    const secret = crypto.randomUUID().replace(/-/g, '').toUpperCase();
    const expiresAt = new Date(Date.now() + ENROLLMENT_WINDOW_MS);

    this.pending.set(userId, { secret, expiresAt });

    const qrCodeData = `otpauth://totp/Platform:${userId}?secret=${secret}&issuer=Platform&algorithm=SHA1&digits=6&period=${String(TOTP_PERIOD)}`;

    return Promise.resolve(ok({ secret, qrCodeData, expiresAt }));
  }

  async confirmEnrollment(
    userId: string,
    code: string,
  ): Promise<Result<RecoveryCodes, IdentityError>> {
    const pending = this.pending.get(userId);
    if (!pending || pending.expiresAt < new Date()) {
      this.pending.delete(userId);
      return err(new IdentityError('INVALID_STATE', 'No pending TOTP enrollment for this user'));
    }

    // Accept current or adjacent window for clock skew
    const window = currentTotpWindow();
    const valid = [window - 1, window, window + 1].some(
      (w) => totpCode(pending.secret, w) === code,
    );

    if (!valid) {
      return err(new IdentityError('MFA_FAILED', 'Invalid TOTP code'));
    }

    this.pending.delete(userId);

    // Persist the secret encrypted (in-memory: store plaintext with a fake marker)
    await this.userDirectory.setMfaSecret(userId, {
      ciphertext: pending.secret,
      keyVersion: 'v1-plaintext',
    });

    // Generate recovery codes
    const codes = Array.from({ length: CODE_COUNT }, () => generateNumericCode(CODE_LENGTH));
    // In production: hash each code with argon2id before storage
    await this.userDirectory.setRecoveryCodes(
      userId,
      codes.map((c) => `hash:${c}`),
    );

    return ok({ codes });
  }

  async verifyTotp(userId: string, code: string): Promise<Result<void, IdentityError>> {
    const secretResult = await this.userDirectory.getMfaSecret(userId);
    if (secretResult.isErr()) return err(secretResult.error);

    const stored = secretResult.value;
    if (!stored) {
      return err(new IdentityError('MFA_NOT_ENROLLED', 'MFA not enabled for this user'));
    }

    const secret = stored.ciphertext;
    const window = currentTotpWindow();
    const valid = [window - 1, window, window + 1].some((w) => totpCode(secret, w) === code);

    if (!valid) {
      return err(new IdentityError('MFA_FAILED', 'Invalid TOTP code'));
    }
    return ok(undefined);
  }

  async verifyRecoveryCode(userId: string, code: string): Promise<Result<void, IdentityError>> {
    const secretResult = await this.userDirectory.getMfaSecret(userId);
    if (secretResult.isErr()) return err(secretResult.error);
    if (!secretResult.value) {
      return err(new IdentityError('MFA_NOT_ENROLLED', 'MFA not enabled for this user'));
    }

    // In production: hash the incoming code and look for it in the stored hashes
    const consumed = (
      await this.userDirectory.consumeRecoveryCode(userId, `hash:${code}`)
    )._unsafeUnwrap();

    if (!consumed) {
      return err(new IdentityError('MFA_FAILED', 'Invalid or already-used recovery code'));
    }
    return ok(undefined);
  }

  async disable(userId: string): Promise<Result<void, IdentityError>> {
    const secretResult = await this.userDirectory.getMfaSecret(userId);
    if (secretResult.isErr()) return err(secretResult.error);

    if (!secretResult.value) {
      return err(new IdentityError('MFA_NOT_ENROLLED', 'MFA not enabled for this user'));
    }

    await this.userDirectory.setMfaSecret(userId, { ciphertext: '', keyVersion: '' });
    await this.userDirectory.setRecoveryCodes(userId, []);
    this.pending.delete(userId);
    return ok(undefined);
  }

  async regenerateRecoveryCodes(userId: string): Promise<Result<RecoveryCodes, IdentityError>> {
    const codes = Array.from({ length: CODE_COUNT }, () => generateNumericCode(CODE_LENGTH));
    await this.userDirectory.setRecoveryCodes(
      userId,
      codes.map((c) => `hash:${c}`),
    );
    return ok({ codes });
  }
}
