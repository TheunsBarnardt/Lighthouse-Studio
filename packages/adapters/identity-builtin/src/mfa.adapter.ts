import type { SecretStorePort } from '@platform/ports-config';
import type {
  IdentityError,
  MfaPort,
  RecoveryCodes,
  TotpEnrollment,
  UserDirectoryPort,
} from '@platform/ports-identity';
import type { Result } from 'neverthrow';

import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2';
import { IdentityError as IE } from '@platform/ports-identity';
import { err, ok } from 'neverthrow';
import { randomBytes } from 'node:crypto';
import * as OTPAuth from 'otpauth';

import { decrypt, encrypt } from './crypto.js';

const TOTP_PERIOD = 30;
const TOTP_DIGITS = 6;
const TOTP_SKEW = 1;
const CODE_LENGTH = 8;
const CODE_COUNT = 10;
const ENROLLMENT_WINDOW_MS = 10 * 60 * 1_000;
const MFA_KEY_NAME = 'mfa-totp-encryption-key';

const RECOVERY_ARGON_OPTS = { memoryCost: 16384, timeCost: 2, parallelism: 1 };

interface PendingEnrollment {
  secret: string;
  expiresAt: Date;
}

function generateRecoveryCodes(): string[] {
  return Array.from({ length: CODE_COUNT }, () => {
    const n = randomBytes(4).readUInt32BE(0) % 100_000_000;
    return String(n).padStart(CODE_LENGTH, '0');
  });
}

async function hashCode(code: string): Promise<string> {
  return argonHash(code, RECOVERY_ARGON_OPTS);
}

async function verifyCode(code: string, storedHash: string): Promise<boolean> {
  try {
    return await argonVerify(storedHash, code);
  } catch {
    return false;
  }
}

export interface BuiltinMfaConfig {
  issuer: string;
}

/**
 * MfaPort implementation using TOTP (RFC 6238) via the `otpauth` library.
 * Recovery codes are hashed with argon2id at rest.
 * TOTP secrets are encrypted with AES-256-GCM; the key is stored in the
 * SecretStorePort under the key `mfa-totp-encryption-key`.
 */
export class BuiltinMfaAdapter implements MfaPort {
  private readonly pending = new Map<string, PendingEnrollment>();

  constructor(
    private readonly userDirectory: UserDirectoryPort,
    private readonly secretStore: SecretStorePort,
    private readonly config: BuiltinMfaConfig,
  ) {}

  private async getEncryptionKey(): Promise<string> {
    const result = await this.secretStore.get(MFA_KEY_NAME);
    if (result.isErr()) {
      throw new Error(`MFA encryption key not found in secret store: ${MFA_KEY_NAME}`);
    }
    return result.value;
  }

  generateTotpSecret(userId: string): Promise<Result<TotpEnrollment, IdentityError>> {
    const totp = new OTPAuth.TOTP({
      issuer: this.config.issuer,
      label: userId,
      algorithm: 'SHA1',
      digits: TOTP_DIGITS,
      period: TOTP_PERIOD,
    });
    const secret = totp.secret.base32;
    const expiresAt = new Date(Date.now() + ENROLLMENT_WINDOW_MS);

    this.pending.set(userId, { secret, expiresAt });

    return Promise.resolve(ok({ secret, qrCodeData: totp.toString(), expiresAt }));
  }

  async confirmEnrollment(
    userId: string,
    code: string,
  ): Promise<Result<RecoveryCodes, IdentityError>> {
    const pending = this.pending.get(userId);
    if (!pending || pending.expiresAt < new Date()) {
      this.pending.delete(userId);
      return err(new IE('INVALID_STATE', 'No pending TOTP enrollment or window expired'));
    }

    const totp = new OTPAuth.TOTP({
      algorithm: 'SHA1',
      digits: TOTP_DIGITS,
      period: TOTP_PERIOD,
      secret: OTPAuth.Secret.fromBase32(pending.secret),
    });

    const delta = totp.validate({ token: code, window: TOTP_SKEW });
    if (delta === null) {
      return err(new IE('MFA_FAILED', 'Invalid TOTP code during enrollment'));
    }

    this.pending.delete(userId);

    // Encrypt the TOTP secret before storing
    try {
      const key = await this.getEncryptionKey();
      const ciphertext = encrypt(pending.secret, key);
      const setResult = await this.userDirectory.setMfaSecret(userId, {
        ciphertext,
        keyVersion: 'v1',
      });
      if (setResult.isErr()) return err(setResult.error);
    } catch (e) {
      return err(new IE('PROVIDER_ERROR', `Failed to encrypt TOTP secret: ${String(e)}`, e));
    }

    // Generate and hash recovery codes
    const codes = generateRecoveryCodes();
    const hashedCodes = await Promise.all(codes.map(hashCode));
    await this.userDirectory.setRecoveryCodes(userId, hashedCodes);

    return ok({ codes });
  }

  async verifyTotp(userId: string, code: string): Promise<Result<void, IdentityError>> {
    const secretResult = await this.userDirectory.getMfaSecret(userId);
    if (secretResult.isErr()) return err(secretResult.error);
    const stored = secretResult.value;
    if (!stored || stored.ciphertext === '') {
      return err(new IE('MFA_NOT_ENROLLED', 'MFA not enabled for this user'));
    }

    let plainSecret: string;
    try {
      const key = await this.getEncryptionKey();
      plainSecret = decrypt(stored.ciphertext, key);
    } catch (e) {
      return err(new IE('PROVIDER_ERROR', `Failed to decrypt TOTP secret: ${String(e)}`, e));
    }

    const totp = new OTPAuth.TOTP({
      algorithm: 'SHA1',
      digits: TOTP_DIGITS,
      period: TOTP_PERIOD,
      secret: OTPAuth.Secret.fromBase32(plainSecret),
    });

    const delta = totp.validate({ token: code, window: TOTP_SKEW });
    if (delta === null) {
      return err(new IE('MFA_FAILED', 'Invalid TOTP code'));
    }
    return ok(undefined);
  }

  async verifyRecoveryCode(userId: string, code: string): Promise<Result<void, IdentityError>> {
    const secretResult = await this.userDirectory.getMfaSecret(userId);
    if (secretResult.isErr()) return err(secretResult.error);
    if (!secretResult.value || secretResult.value.ciphertext === '') {
      return err(new IE('MFA_NOT_ENROLLED', 'MFA not enabled for this user'));
    }

    // Fetch stored hashed codes and verify each with argon2id
    // The UserDirectoryPort.consumeRecoveryCode takes an already-hashed code
    // in the in-memory adapter, but the real pattern is: we verify with argon2id
    // here and call consumeRecoveryCode with the matching hash once found.
    //
    // Since the port only exposes consumeRecoveryCode(userId, hashedCode), we
    // need to try verifying the plaintext against each stored hash. This
    // requires access to the hash list, which the port doesn't directly expose.
    //
    // v1 design decision: the BuiltinMfaAdapter passes the PLAINTEXT code to
    // consumeRecoveryCode. The UserDirectoryPort implementations (Postgres,
    // MSSQL, Mongo) are responsible for iterating hashes and consuming the
    // matching one. The in-memory adapter does a direct hash comparison.
    //
    // This means consumeRecoveryCode() takes the plaintext code in the context
    // of this MFA adapter. We acknowledge that this couples the adapter and
    // port contract slightly — documented here as an intentional v1 simplification.
    const consumed = (await this.userDirectory.consumeRecoveryCode(userId, code))._unsafeUnwrap();

    if (!consumed) {
      return err(new IE('MFA_FAILED', 'Invalid or already-used recovery code'));
    }
    return ok(undefined);
  }

  async disable(userId: string): Promise<Result<void, IdentityError>> {
    const secretResult = await this.userDirectory.getMfaSecret(userId);
    if (secretResult.isErr()) return err(secretResult.error);
    if (!secretResult.value || secretResult.value.ciphertext === '') {
      return err(new IE('MFA_NOT_ENROLLED', 'MFA not enabled for this user'));
    }

    await this.userDirectory.setMfaSecret(userId, { ciphertext: '', keyVersion: '' });
    await this.userDirectory.setRecoveryCodes(userId, []);
    this.pending.delete(userId);
    return ok(undefined);
  }

  async regenerateRecoveryCodes(userId: string): Promise<Result<RecoveryCodes, IdentityError>> {
    const secretResult = await this.userDirectory.getMfaSecret(userId);
    if (secretResult.isErr()) return err(secretResult.error);
    if (!secretResult.value || secretResult.value.ciphertext === '') {
      return err(new IE('MFA_NOT_ENROLLED', 'MFA not enabled to regenerate recovery codes'));
    }

    const codes = generateRecoveryCodes();
    const hashedCodes = await Promise.all(codes.map(hashCode));
    await this.userDirectory.setRecoveryCodes(userId, hashedCodes);
    return ok({ codes });
  }
}

export { hashCode as hashRecoveryCode, verifyCode as verifyRecoveryCode };
