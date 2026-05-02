import type { IdentityError, VerifiedIdentity } from '@platform/ports-identity';
import type { Result } from 'neverthrow';

import { IdentityError as IE } from '@platform/ports-identity';
import { err, ok } from 'neverthrow';
import * as client from 'openid-client';

import type { FlowStore } from './flows/flow-store.js';

import { expiresAt, generateToken, hashToken, TTL } from './tokens.js';

export interface OAuthProviderConfig {
  id: string;
  displayName: string;
  issuer: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
  extraParams?: Record<string, string>;
}

interface StoredOAuthState {
  providerId: string;
  nonce: string;
  codeVerifier: string;
  redirectAfter: string;
}

/**
 * Handles OAuth 2.0 / OIDC sign-in via `openid-client` v6.
 * State, nonce, and PKCE (S256) are enforced per OAuth 2.1 spec.
 */
export class OAuthRouter {
  private readonly configsById: Map<string, OAuthProviderConfig>;
  private readonly discoveredConfigs = new Map<string, client.Configuration>();

  constructor(
    providerConfigs: OAuthProviderConfig[],
    private readonly stateStore: FlowStore,
    private readonly tokenSecret: string,
  ) {
    this.configsById = new Map(providerConfigs.map((c) => [c.id, c]));
  }

  private async getConfig(providerId: string): Promise<client.Configuration> {
    const cached = this.discoveredConfigs.get(providerId);
    if (cached) return cached;

    const cfg = this.configsById.get(providerId);
    if (!cfg) throw new Error(`Unknown OAuth provider: ${providerId}`);

    const discovered = await client.discovery(new URL(cfg.issuer), cfg.clientId, cfg.clientSecret);
    this.discoveredConfigs.set(providerId, discovered);
    return discovered;
  }

  async beginFlow(
    providerId: string,
    redirectAfter?: string,
  ): Promise<Result<{ authUrl: string; state: string }, IdentityError>> {
    const cfg = this.configsById.get(providerId);
    if (!cfg) {
      return err(new IE('NOT_SUPPORTED', `Unknown OAuth provider: ${providerId}`));
    }

    try {
      const oidcConfig = await this.getConfig(providerId);
      const codeVerifier = client.randomPKCECodeVerifier();
      const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
      const nonce = client.randomNonce();
      const state = generateToken();
      const stateHash = hashToken(state, this.tokenSecret);

      const storedState: StoredOAuthState = {
        providerId,
        nonce,
        codeVerifier,
        redirectAfter: redirectAfter ?? '',
      };

      await this.stateStore.set(stateHash, {
        tokenHash: stateHash,
        userId: '',
        email: '',
        expiresAt: expiresAt(TTL.OAUTH_STATE),
        consumedAt: null,
        metadata: storedState as unknown as Record<string, unknown>,
      });

      const params = new URLSearchParams({
        redirect_uri: cfg.redirectUri,
        scope: cfg.scopes.join(' '),
        state,
        nonce,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        response_type: 'code',
        ...cfg.extraParams,
      });

      const authUrl = client.buildAuthorizationUrl(oidcConfig, params);
      return ok({ authUrl: authUrl.href, state });
    } catch (e) {
      return err(new IE('PROVIDER_ERROR', `OAuth init failed: ${String(e)}`, e));
    }
  }

  async completeFlow(
    callbackUrl: string,
    returnedState: string,
  ): Promise<Result<VerifiedIdentity, IdentityError>> {
    const stateHash = hashToken(returnedState, this.tokenSecret);
    const record = await this.stateStore.get(stateHash);

    if (!record) {
      return err(new IE('TOKEN_INVALID', 'OAuth state token is invalid or expired'));
    }

    const consumed = await this.stateStore.consume(stateHash);
    if (!consumed) {
      return err(new IE('TOKEN_INVALID', 'OAuth state already consumed (replay attack?)'));
    }

    const meta = record.metadata as unknown as StoredOAuthState;
    const cfg = this.configsById.get(meta.providerId);
    if (!cfg) {
      return err(new IE('PROVIDER_ERROR', 'OAuth provider no longer configured'));
    }

    try {
      const oidcConfig = await this.getConfig(meta.providerId);

      const tokens = await client.authorizationCodeGrant(oidcConfig, new URL(callbackUrl), {
        pkceCodeVerifier: meta.codeVerifier,
        expectedNonce: meta.nonce,
        expectedState: returnedState,
      });

      const claims = tokens.claims();
      if (!claims) {
        return err(new IE('PROVIDER_ERROR', 'No claims in token response'));
      }

      const email = typeof claims['email'] === 'string' ? claims['email'] : undefined;
      const emailVerified =
        typeof claims['email_verified'] === 'boolean' ? claims['email_verified'] : false;
      const displayName = typeof claims['name'] === 'string' ? claims['name'] : undefined;

      return ok({
        subject: claims.sub,
        providerId: meta.providerId,
        emailVerified,
        claims: claims as Record<string, unknown>,
        ...(email !== undefined ? { email } : {}),
        ...(displayName !== undefined ? { displayName } : {}),
      });
    } catch (e) {
      return err(new IE('PROVIDER_ERROR', `OAuth callback failed: ${String(e)}`, e));
    }
  }
}
