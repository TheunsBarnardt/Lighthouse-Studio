import type { EmailPort } from '@platform/ports-communication';
import type { IdentityError, UserDirectoryPort } from '@platform/ports-identity';
import type { Result } from 'neverthrow';

import { IdentityError as IE } from '@platform/ports-identity';
import { err, ok } from 'neverthrow';

import type { FlowStore } from './flow-store.js';

import { expiresAt, generateToken, hashToken, TTL } from '../tokens.js';

export interface MagicLinkConfig {
  tokenSecret: string;
  callbackUrl: string;
  fromEmail: string;
  fromName?: string;
}

export class MagicLinkFlow {
  constructor(
    private readonly store: FlowStore,
    private readonly userDirectory: UserDirectoryPort,
    private readonly email: EmailPort,
    private readonly config: MagicLinkConfig,
  ) {}

  async send(emailAddress: string): Promise<Result<void, IdentityError>> {
    const user = (await this.userDirectory.findByEmail(emailAddress))._unsafeUnwrap();
    if (!user || user.status === 'archived') {
      return ok(undefined); // silent success — enumeration prevention
    }

    const token = generateToken();
    const hash = hashToken(token, this.config.tokenSecret);

    await this.store.set(hash, {
      tokenHash: hash,
      userId: user.id,
      email: emailAddress,
      expiresAt: expiresAt(TTL.MAGIC_LINK),
      consumedAt: null,
      metadata: {},
    });

    const link = `${this.config.callbackUrl}?token=${token}`;

    try {
      await this.email.send({
        from: {
          email: this.config.fromEmail,
          ...(this.config.fromName !== undefined ? { name: this.config.fromName } : {}),
        },
        to: [{ email: emailAddress }],
        subject: 'Your sign-in link',
        bodyText: `Click here to sign in (expires in 15 minutes): ${link}`,
        bodyHtml: `<p>Click here to sign in (expires in 15 minutes): <a href="${link}">${link}</a></p>`,
      });
    } catch {
      // Swallow — enumeration prevention
    }

    return ok(undefined);
  }

  async consume(token: string): Promise<Result<{ userId: string; email: string }, IdentityError>> {
    const hash = hashToken(token, this.config.tokenSecret);
    const record = await this.store.get(hash);

    if (!record) {
      return err(new IE('TOKEN_INVALID', 'Magic link token is invalid or expired'));
    }

    const consumed = await this.store.consume(hash);
    if (!consumed) {
      return err(new IE('TOKEN_INVALID', 'Magic link already used'));
    }

    return ok({ userId: record.userId, email: record.email });
  }
}
