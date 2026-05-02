import type { EmailPort } from '@platform/ports-communication';
import type { IdentityError } from '@platform/ports-identity';
import type { Result } from 'neverthrow';

import { IdentityError as IE } from '@platform/ports-identity';
import { err, ok } from 'neverthrow';

import type { FlowStore } from './flow-store.js';

import { expiresAt, generateToken, hashToken, TTL } from '../tokens.js';

export interface EmailVerificationConfig {
  tokenSecret: string;
  verifyUrl: string;
  fromEmail: string;
  fromName?: string;
}

export class EmailVerificationFlow {
  constructor(
    private readonly store: FlowStore,
    private readonly email: EmailPort,
    private readonly config: EmailVerificationConfig,
  ) {}

  async send(userId: string, emailAddress: string): Promise<Result<void, IdentityError>> {
    const token = generateToken();
    const hash = hashToken(token, this.config.tokenSecret);

    await this.store.set(hash, {
      tokenHash: hash,
      userId,
      email: emailAddress,
      expiresAt: expiresAt(TTL.EMAIL_VERIFICATION),
      consumedAt: null,
      metadata: {},
    });

    const link = `${this.config.verifyUrl}?token=${token}`;

    try {
      const sendResult = await this.email.send({
        from: {
          email: this.config.fromEmail,
          ...(this.config.fromName !== undefined ? { name: this.config.fromName } : {}),
        },
        to: [{ email: emailAddress }],
        subject: 'Verify your email address',
        bodyText: `Click here to verify your email: ${link}`,
        bodyHtml: `<p>Click here to verify your email: <a href="${link}">${link}</a></p>`,
      });
      if (sendResult.isErr()) {
        return err(
          new IE(
            'PROVIDER_ERROR',
            `Failed to send verification email: ${sendResult.error.message}`,
          ),
        );
      }
    } catch (e) {
      return err(new IE('PROVIDER_ERROR', `Failed to send verification email: ${String(e)}`, e));
    }

    return ok(undefined);
  }

  async verify(token: string): Promise<Result<{ userId: string }, IdentityError>> {
    const hash = hashToken(token, this.config.tokenSecret);
    const record = await this.store.get(hash);

    if (!record) {
      return err(new IE('TOKEN_INVALID', 'Email verification token is invalid or expired'));
    }

    const consumed = await this.store.consume(hash);
    if (!consumed) {
      return err(new IE('TOKEN_INVALID', 'Email verification token already used'));
    }

    return ok({ userId: record.userId });
  }
}
