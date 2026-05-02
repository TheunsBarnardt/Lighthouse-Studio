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

import type { EntraAdapterConfig, EntraStateStore } from './config.js';

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

function buildEntraIssuer(tenantId: string): string {
  return `https://login.microsoftonline.com/${tenantId}/v2.0`;
}

/**
 * Microsoft Entra ID (Azure AD) identity provider adapter.
 *
 * Uses OIDC via openid-client v6 against the Microsoft identity platform v2.0 endpoint.
 * Supports tenant-aware configuration, group sync via Microsoft Graph, and JIT provisioning.
 * PKCE (S256) + nonce + state are enforced per OAuth 2.1.
 */
export class EntraIdentityProvider implements IdentityProviderPort {
  private discoveredConfig: client.Configuration | null = null;

  constructor(
    private readonly config: EntraAdapterConfig,
    private readonly stateStore: EntraStateStore,
  ) {}

  // ── IdentityProviderPort ──────────────────────────────────────────────────

  getMetadata(): IdentityProviderMetadata {
    const capabilities: IdentityFeature[] = ['oidc', 'rp_initiated_logout'];
    if (this.config.justInTimeProvisioning) capabilities.push('just_in_time_provisioning');
    if (this.config.groupSync) capabilities.push('group_sync');
    capabilities.push('attribute_mapping');
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
        new IE('NOT_SUPPORTED', `EntraIdentityProvider does not handle method: ${input.method}`),
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

      const baseScopes = ['openid', 'email', 'profile', 'offline_access'];
      const extraScopes = this.config.scopes ?? [];
      const scopes = [...new Set([...baseScopes, ...extraScopes])];

      const params = new URLSearchParams({
        redirect_uri: this.config.redirectUri,
        scope: scopes.join(' '),
        state,
        nonce,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        response_type: 'code',
      });

      const authUrl = client.buildAuthorizationUrl(oidcConfig, params);
      return ok({ kind: 'redirect', url: authUrl.href });
    } catch (e) {
      return err(new IE('PROVIDER_ERROR', `Entra authorization failed: ${String(e)}`, e));
    }
  }

  async completeSignIn(input: SignInCompletion): Promise<Result<VerifiedIdentity, IdentityError>> {
    if (input.method !== 'oidc') {
      return err(
        new IE('NOT_SUPPORTED', `EntraIdentityProvider does not handle method: ${input.method}`),
      );
    }

    // input.code carries the full callback URL; input.state carries the original state value
    if (!input.code || !input.state) {
      return err(new IE('INVALID_STATE', 'Entra callback requires callbackUrl (code) and state'));
    }

    const stateHash = hashToken(input.state, this.config.tokenSecret);
    const raw = await this.stateStore.get(stateHash);
    if (!raw) {
      return err(new IE('TOKEN_INVALID', 'Entra state is invalid or expired'));
    }

    const consumed = await this.stateStore.consume(stateHash);
    if (!consumed) {
      return err(new IE('TOKEN_INVALID', 'Entra state already consumed (possible replay)'));
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
        return err(new IE('PROVIDER_ERROR', 'No ID token claims in Entra token response'));
      }

      const email =
        typeof claims['email'] === 'string'
          ? claims['email']
          : typeof claims['preferred_username'] === 'string'
            ? claims['preferred_username']
            : undefined;

      const displayName = typeof claims['name'] === 'string' ? claims['name'] : undefined;

      // Entra always marks email as verified for managed accounts
      const emailVerified = email !== undefined;

      const enrichedClaims: Record<string, unknown> = {
        ...(claims as Record<string, unknown>),
      };

      if (this.config.groupSync) {
        const accessToken =
          typeof tokens.access_token === 'string' ? tokens.access_token : undefined;
        if (accessToken) {
          const groups = await this.fetchGroupMemberships(accessToken);
          enrichedClaims['groups'] = groups;
        }
      }

      return ok({
        subject: claims.sub,
        providerId: this.config.id,
        emailVerified,
        claims: enrichedClaims,
        ...(email !== undefined ? { email } : {}),
        ...(displayName !== undefined ? { displayName } : {}),
      });
    } catch (e) {
      return err(new IE('PROVIDER_ERROR', `Entra token exchange failed: ${String(e)}`, e));
    }
  }

  verifyToken(_token: string): Promise<Result<VerifiedIdentity, IdentityError>> {
    return Promise.resolve(
      err(new IE('NOT_SUPPORTED', 'Use SessionPort to verify tokens for federated providers')),
    );
  }

  signOut(_token: string): Promise<Result<void, IdentityError>> {
    return Promise.resolve(ok(undefined));
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private async getDiscoveredConfig(): Promise<client.Configuration> {
    if (this.discoveredConfig) return this.discoveredConfig;
    const issuer = buildEntraIssuer(this.config.tenantId);
    this.discoveredConfig = await client.discovery(
      new URL(issuer),
      this.config.clientId,
      this.config.clientSecret,
    );
    return this.discoveredConfig;
  }

  private async fetchGroupMemberships(accessToken: string): Promise<string[]> {
    try {
      const resp = await fetch(
        'https://graph.microsoft.com/v1.0/me/memberOf?$select=id,displayName',
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
      if (!resp.ok) return [];
      const body = (await resp.json()) as { value?: Array<{ id?: string; displayName?: string }> };
      return (body.value ?? []).map((g) => g.id ?? '').filter(Boolean);
    } catch {
      return [];
    }
  }
}
