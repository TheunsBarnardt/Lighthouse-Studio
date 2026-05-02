import type {
  IdentityError,
  IdentityFeature,
  IdentityProviderMetadata,
  IdentityProviderPort,
  SignInChallenge,
  SignInCompletion,
  SignInInput,
  VerifiedIdentity,
} from '@platform/ports-identity';
import type { Result } from 'neverthrow';

import { IdentityError as IE } from '@platform/ports-identity';
import { err, ok } from 'neverthrow';
import { createHmac, randomBytes } from 'node:crypto';
import * as client from 'openid-client';

import type { OidcAdapterConfig, OidcStateStore } from './config.js';

interface StoredState {
  nonce: string;
  codeVerifier: string;
}

function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

function hashToken(token: string, secret: string): string {
  return createHmac('sha256', secret).update(token).digest('hex');
}

/**
 * Generic OIDC identity provider adapter.
 *
 * Works with any OIDC-compliant IdP (Okta, Auth0, Keycloak, etc.).
 * Uses PKCE (S256) + nonce + state per OAuth 2.1.
 * Session management is handled externally via SessionPort.
 */
export class OidcIdentityProvider implements IdentityProviderPort {
  private discoveredConfig: client.Configuration | null = null;

  constructor(
    private readonly config: OidcAdapterConfig,
    private readonly stateStore: OidcStateStore,
  ) {}

  // ── IdentityProviderPort ──────────────────────────────────────────────────

  getMetadata(): IdentityProviderMetadata {
    const capabilities: IdentityFeature[] = ['oidc'];
    if (this.config.justInTimeProvisioning) capabilities.push('just_in_time_provisioning');
    if (this.config.rpInitiatedLogout) capabilities.push('rp_initiated_logout');
    return {
      id: this.config.id,
      displayName: this.config.displayName,
      capabilities,
      ...(this.config.iconUrl !== undefined ? { iconUrl: this.config.iconUrl } : {}),
    };
  }

  supports(feature: IdentityFeature): boolean {
    return this.getMetadata().capabilities.includes(feature);
  }

  async beginSignIn(input: SignInInput): Promise<Result<SignInChallenge, IdentityError>> {
    if (input.method !== 'oidc') {
      return err(
        new IE('NOT_SUPPORTED', `OidcIdentityProvider does not handle method: ${input.method}`),
      );
    }

    try {
      const oidcConfig = await this.getDiscoveredConfig();
      const codeVerifier = client.randomPKCECodeVerifier();
      const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
      const nonce = client.randomNonce();
      const state = generateToken();
      const stateHash = hashToken(state, this.config.tokenSecret);

      const stored: StoredState = { nonce, codeVerifier };
      await this.stateStore.set(
        stateHash,
        JSON.stringify(stored),
        new Date(Date.now() + 10 * 60 * 1_000),
      );

      const scopes = this.config.scopes ?? ['openid', 'email', 'profile'];
      const params = new URLSearchParams({
        redirect_uri: this.config.redirectUri,
        scope: scopes.join(' '),
        state,
        nonce,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        response_type: 'code',
        ...this.config.extraParams,
      });

      const authUrl = client.buildAuthorizationUrl(oidcConfig, params);
      return ok({ kind: 'redirect', url: authUrl.href });
    } catch (e) {
      return err(new IE('PROVIDER_ERROR', `OIDC authorization failed: ${String(e)}`, e));
    }
  }

  async completeSignIn(input: SignInCompletion): Promise<Result<VerifiedIdentity, IdentityError>> {
    if (input.method !== 'oidc') {
      return err(
        new IE('NOT_SUPPORTED', `OidcIdentityProvider does not handle method: ${input.method}`),
      );
    }

    // input.code carries the full callback URL; input.state carries the original state value
    if (!input.code || !input.state) {
      return err(new IE('INVALID_STATE', 'OIDC callback requires callbackUrl (code) and state'));
    }

    const stateHash = hashToken(input.state, this.config.tokenSecret);
    const raw = await this.stateStore.get(stateHash);
    if (!raw) {
      return err(new IE('TOKEN_INVALID', 'OIDC state is invalid or expired'));
    }

    const consumed = await this.stateStore.consume(stateHash);
    if (!consumed) {
      return err(new IE('TOKEN_INVALID', 'OIDC state already consumed (possible replay)'));
    }

    const stored = JSON.parse(raw) as StoredState;

    try {
      const oidcConfig = await this.getDiscoveredConfig();
      const tokens = await client.authorizationCodeGrant(oidcConfig, new URL(input.code), {
        pkceCodeVerifier: stored.codeVerifier,
        expectedNonce: stored.nonce,
        expectedState: input.state,
      });

      const claims = tokens.claims();
      if (!claims) {
        return err(new IE('PROVIDER_ERROR', 'No ID token claims in OIDC token response'));
      }

      const emailClaim = this.config.claimMapping?.email ?? 'email';
      const displayNameClaim = this.config.claimMapping?.displayName ?? 'name';

      const email = typeof claims[emailClaim] === 'string' ? claims[emailClaim] : undefined;
      const emailVerified =
        typeof claims['email_verified'] === 'boolean' ? claims['email_verified'] : false;
      const displayName =
        typeof claims[displayNameClaim] === 'string' ? claims[displayNameClaim] : undefined;

      return ok({
        subject: claims.sub,
        providerId: this.config.id,
        emailVerified,
        claims: claims as Record<string, unknown>,
        ...(email !== undefined ? { email } : {}),
        ...(displayName !== undefined ? { displayName } : {}),
      });
    } catch (e) {
      return err(new IE('PROVIDER_ERROR', `OIDC token exchange failed: ${String(e)}`, e));
    }
  }

  verifyToken(_token: string): Promise<Result<VerifiedIdentity, IdentityError>> {
    // Federated adapters do not manage sessions. Session verification is handled
    // at the platform layer via SessionPort.
    return Promise.resolve(
      err(new IE('NOT_SUPPORTED', 'Use SessionPort to verify tokens for federated providers')),
    );
  }

  signOut(_token: string): Promise<Result<void, IdentityError>> {
    // Session revocation is handled at the platform layer via SessionPort.
    // RP-initiated logout (if supported) would be triggered separately by the platform.
    return Promise.resolve(ok(undefined));
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private async getDiscoveredConfig(): Promise<client.Configuration> {
    if (this.discoveredConfig) return this.discoveredConfig;
    this.discoveredConfig = await client.discovery(
      new URL(this.config.issuer),
      this.config.clientId,
      this.config.clientSecret,
    );
    return this.discoveredConfig;
  }
}
