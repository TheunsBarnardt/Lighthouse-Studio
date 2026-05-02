import type { EmailPort } from '@platform/ports-communication';
import type { IdentityError, UserDirectoryPort } from '@platform/ports-identity';
import type { Result } from 'neverthrow';

import { IdentityError as IE } from '@platform/ports-identity';
import { err, ok } from 'neverthrow';

import type { FlowStore } from './flow-store.js';

import { MIN_PASSWORD_LENGTH, validatePasswordLength } from '../hibp.js';
import { hashPassword } from '../password.js';
import { expiresAt, generateToken, hashToken, TTL } from '../tokens.js';

export interface PasswordResetConfig {
  tokenSecret: string;
  resetUrl: string;
  fromEmail: string;
  fromName?: string;
}

export class PasswordResetFlow {
  constructor(
    private readonly store: FlowStore,
    private readonly userDirectory: UserDirectoryPort,
    private readonly email: EmailPort,
    private readonly config: PasswordResetConfig,
  ) {}

  async request(emailAddress: string, ipAddress: string): Promise<Result<void, IdentityError>> {
    const user = (await this.userDirectory.findByEmail(emailAddress))._unsafeUnwrap();
    if (!user || user.status === 'archived') {
      return ok(undefined); // Email enumeration prevention
    }

    const token = generateToken();
    const hash = hashToken(token, this.config.tokenSecret);

    await this.store.set(hash, {
      tokenHash: hash,
      userId: user.id,
      email: emailAddress,
      expiresAt: expiresAt(TTL.PASSWORD_RESET),
      consumedAt: null,
      metadata: { ipAddress },
    });

    const link = `${this.config.resetUrl}?token=${token}`;

    try {
      await this.email.send({
        from: {
          email: this.config.fromEmail,
          ...(this.config.fromName !== undefined ? { name: this.config.fromName } : {}),
        },
        to: [{ email: emailAddress }],
        subject: 'Reset your password',
        bodyText: `Click here to reset your password (expires in 1 hour): ${link}`,
        bodyHtml: `<p>Click here to reset your password (expires in 1 hour): <a href="${link}">${link}</a></p>`,
      });
    } catch {
      // Swallow email errors — return ok to prevent enumeration
    }

    return ok(undefined);
  }

  async complete(
    token: string,
    newPassword: string,
  ): Promise<Result<{ userId: string }, IdentityError>> {
    if (!validatePasswordLength(newPassword)) {
      return err(
        new IE(
          'INVALID_STATE',
          `Password must be at least ${String(MIN_PASSWORD_LENGTH)} characters`,
        ),
      );
    }

    const hash = hashToken(token, this.config.tokenSecret);
    const record = await this.store.get(hash);

    if (!record) {
      return err(new IE('TOKEN_INVALID', 'Password reset token is invalid or expired'));
    }

    const consumed = await this.store.consume(hash);
    if (!consumed) {
      return err(new IE('TOKEN_INVALID', 'Password reset token already used'));
    }

    const passwordHash = await hashPassword(newPassword);
    const setResult = await this.userDirectory.setPasswordHash(record.userId, passwordHash);
    if (setResult.isErr()) return err(setResult.error);

    await this.userDirectory.resetFailedLogins(record.userId);

    return ok({ userId: record.userId });
  }
}
