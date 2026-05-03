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

import type { WindowsIntegratedConfig } from './config.js';

/**
 * Identity provider that trusts Windows Integrated Authentication headers
 * injected by IIS after a successful Kerberos/NTLM handshake.
 *
 * SECURITY: This adapter must only be deployed behind IIS. The trusted
 * proxy IPs must be locked down to the IIS server's loopback/LAN address.
 * Any exposure of the Node port that bypasses IIS invalidates the security
 * model of this adapter.
 *
 * See ADR-0087 for the full security model and threat analysis.
 */
export class WindowsIntegratedIdentityProvider implements IdentityProviderPort {
  constructor(private readonly config: WindowsIntegratedConfig) {}

  beginSignIn(_input: SignInInput): Promise<Result<SignInChallenge, IdentityError>> {
    return Promise.resolve(
      err(
        new IdentityError(
          'windows_integrated_auth_no_challenge',
          'Windows Integrated Auth does not support an explicit sign-in flow. ' +
            'The principal header must be set by IIS before the request reaches Node.',
        ),
      ),
    );
  }

  completeSignIn(_input: SignInCompletion): Promise<Result<VerifiedIdentity, IdentityError>> {
    return Promise.resolve(
      err(
        new IdentityError(
          'windows_integrated_auth_no_challenge',
          'Windows Integrated Auth does not use a challenge-response flow.',
        ),
      ),
    );
  }

  verifyToken(token: string): Promise<Result<VerifiedIdentity, IdentityError>> {
    const principal = token.trim();
    if (!principal) {
      return Promise.resolve(
        err(new IdentityError('missing_principal', 'No Windows principal in request.')),
      );
    }

    const parts = principal.includes('\\') ? (principal.split('\\', 2) as [string, string]) : null;
    const domain = parts?.[0] ?? '';
    const user = parts?.[1] ?? principal;

    const sub = domain ? `${user}@${domain.toLowerCase()}` : principal;

    return Promise.resolve(
      ok({
        sub,
        email: sub.includes('@') ? sub : undefined,
        displayName: user,
        provider: 'windows-integrated',
        raw: { windowsPrincipal: principal },
      } satisfies VerifiedIdentity),
    );
  }

  signOut(_token: string): Promise<Result<void, IdentityError>> {
    return Promise.resolve(ok(undefined));
  }

  supports(feature: IdentityFeature): boolean {
    return feature === 'sso';
  }

  getMetadata(): IdentityProviderMetadata {
    return {
      name: 'Windows Integrated Authentication',
      type: 'windows-integrated',
      capabilities: ['sso'],
      trustedProxyIps: this.config.trustedProxyIps,
    };
  }
}
