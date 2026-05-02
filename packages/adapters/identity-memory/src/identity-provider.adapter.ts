import type {
  IdentityFeature,
  IdentityProviderMetadata,
  IdentityProviderPort,
  SignInChallenge,
  SignInCompletion,
  SignInInput,
  VerifiedIdentity,
} from '@platform/ports-identity';
import type { Result } from 'neverthrow';

import { IdentityError } from '@platform/ports-identity';
import { err, ok } from 'neverthrow';

export class InMemoryIdentityProvider implements IdentityProviderPort {
  private readonly tokens = new Map<string, VerifiedIdentity>();

  beginSignIn(input: SignInInput): Promise<Result<SignInChallenge, IdentityError>> {
    if (input.method !== 'password') {
      return Promise.resolve(
        err(new IdentityError('NOT_SUPPORTED', `Method not supported: ${input.method}`)),
      );
    }
    const identity: VerifiedIdentity = {
      subject: input.email ?? 'test-user',
      emailVerified: true,
      providerId: 'memory',
      claims: {},
      ...(input.email !== undefined ? { email: input.email } : {}),
    };
    return Promise.resolve(ok({ kind: 'complete', identity }));
  }

  completeSignIn(input: SignInCompletion): Promise<Result<VerifiedIdentity, IdentityError>> {
    const identity: VerifiedIdentity = {
      subject: `user-${String(Date.now())}`,
      emailVerified: true,
      providerId: 'memory',
      claims: {},
    };
    const token = input.code ?? crypto.randomUUID();
    this.tokens.set(token, identity);
    return Promise.resolve(ok(identity));
  }

  verifyToken(token: string): Promise<Result<VerifiedIdentity, IdentityError>> {
    const identity = this.tokens.get(token);
    if (!identity)
      return Promise.resolve(err(new IdentityError('TOKEN_INVALID', `Invalid token: ${token}`)));
    return Promise.resolve(ok(identity));
  }

  signOut(token: string): Promise<Result<void, IdentityError>> {
    this.tokens.delete(token);
    return Promise.resolve(ok(undefined));
  }

  supports(feature: IdentityFeature): boolean {
    return feature === 'password';
  }

  getMetadata(): IdentityProviderMetadata {
    return {
      id: 'memory',
      displayName: 'In-Memory (Test)',
      capabilities: ['password'],
    };
  }
}
