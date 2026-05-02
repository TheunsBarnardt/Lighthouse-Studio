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
import { SAML } from 'node-saml';

import type { SamlAdapterConfig } from './config.js';

// Common email attribute name aliases across IdP vendors
const EMAIL_CLAIM_ALIASES = [
  'email',
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
  'http://schemas.xmlsoap.org/claims/EmailAddress',
  'mail',
];

// Common display name attribute aliases
const DISPLAY_NAME_CLAIM_ALIASES = [
  'displayName',
  'http://schemas.microsoft.com/identity/claims/displayname',
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname',
  'name',
];

function pickAttr(attrs: Record<string, unknown>, candidates: string[]): string | undefined {
  for (const key of candidates) {
    const val = attrs[key];
    if (typeof val === 'string' && val.length > 0) return val;
  }
  return undefined;
}

/**
 * SAML 2.0 SP identity provider adapter.
 *
 * Uses the HTTP-Redirect binding for AuthnRequests and HTTP-POST binding for SAMLResponse.
 * The platform's SAML callback endpoint receives SAMLResponse (and optionally RelayState)
 * from the IdP's POST, then calls completeSignIn with:
 *   { method: 'saml', code: <SAMLResponse value>, state: <RelayState value> }
 *
 * Session management is handled externally via SessionPort.
 */
export class SamlIdentityProvider implements IdentityProviderPort {
  private readonly saml: SAML;

  constructor(private readonly config: SamlAdapterConfig) {
    this.saml = new SAML({
      callbackUrl: config.callbackUrl,
      issuer: config.entityId,
      entryPoint: config.entryPoint,
      cert: config.idpCert,
      ...(config.privateKey !== undefined ? { privateCert: config.privateKey } : {}),
      signatureAlgorithm: 'sha256',
      digestAlgorithm: 'sha256',
      disableRequestedAuthnContext: false,
    });
  }

  // ── IdentityProviderPort ──────────────────────────────────────────────────

  getMetadata(): IdentityProviderMetadata {
    const capabilities: IdentityFeature[] = ['saml', 'attribute_mapping'];
    if (this.config.justInTimeProvisioning) capabilities.push('just_in_time_provisioning');
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
    if (input.method !== 'saml') {
      return err(
        new IE('NOT_SUPPORTED', `SamlIdentityProvider does not handle method: ${input.method}`),
      );
    }

    try {
      // RelayState carries the post-login redirect URL (empty string if not provided)
      const redirectUrl = await this.saml.getAuthorizeUrl({
        RelayState: input.redirectUri ?? '',
      });
      return ok({ kind: 'redirect', url: redirectUrl });
    } catch (e) {
      return err(new IE('PROVIDER_ERROR', `SAML AuthnRequest generation failed: ${String(e)}`, e));
    }
  }

  async completeSignIn(input: SignInCompletion): Promise<Result<VerifiedIdentity, IdentityError>> {
    if (input.method !== 'saml') {
      return err(
        new IE('NOT_SUPPORTED', `SamlIdentityProvider does not handle method: ${input.method}`),
      );
    }

    // input.code carries the raw SAMLResponse value from the IdP's POST body
    if (!input.code) {
      return err(new IE('INVALID_STATE', 'SAML callback requires SAMLResponse (code)'));
    }

    try {
      const body: { SAMLResponse: string; RelayState?: string } = {
        SAMLResponse: input.code,
        ...(input.state ? { RelayState: input.state } : {}),
      };

      const { profile, success } = await this.saml.validatePostResponse(body);

      // success: true = logout response; profile !== null = login assertion
      if (success || !profile) {
        return err(new IE('TOKEN_INVALID', 'SAML response was a logout or contained no profile'));
      }

      const attrs = profile as Record<string, unknown>;

      const emailAttrName = this.config.attributeMapping?.email;
      const displayNameAttrName = this.config.attributeMapping?.displayName;

      const email = emailAttrName
        ? typeof attrs[emailAttrName] === 'string'
          ? attrs[emailAttrName]
          : undefined
        : pickAttr(attrs, EMAIL_CLAIM_ALIASES);

      const displayName = displayNameAttrName
        ? typeof attrs[displayNameAttrName] === 'string'
          ? attrs[displayNameAttrName]
          : undefined
        : pickAttr(attrs, DISPLAY_NAME_CLAIM_ALIASES);

      // Enterprise IdP assertions are trusted; mark email as verified when present
      const emailVerified = email !== undefined;

      return ok({
        subject: profile.nameID,
        providerId: this.config.id,
        emailVerified,
        claims: attrs,
        ...(email !== undefined ? { email } : {}),
        ...(displayName !== undefined ? { displayName } : {}),
      });
    } catch (e) {
      return err(new IE('PROVIDER_ERROR', `SAML response validation failed: ${String(e)}`, e));
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
}
