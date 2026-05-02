export interface SamlAdapterConfig {
  /** Stable identifier matching the IdentityProviderPort metadata id. */
  id: string;
  displayName: string;
  iconUrl?: string;

  // ── SP (Service Provider) settings ────────────────────────────────────────

  /** SP entity ID (usually the application metadata URL). */
  entityId: string;
  /** ACS (Assertion Consumer Service) URL where the IDP will POST the SAMLResponse. */
  callbackUrl: string;
  /**
   * SP private key (PEM) for signing AuthnRequests and for encryption.
   * If omitted, AuthnRequests are sent unsigned.
   */
  privateKey?: string;

  // ── IdP (Identity Provider) settings ──────────────────────────────────────

  /** IDP SSO URL (HTTP-Redirect or HTTP-POST binding). */
  entryPoint: string;
  /**
   * IDP signing certificate(s) in PEM format. Provide multiple for key rotation.
   * Note: node-saml accepts the raw base64 content (without header/footer lines),
   * or the full PEM string — the adapter normalises to PEM internally.
   */
  idpCert: string | string[];

  // ── Attribute mapping ──────────────────────────────────────────────────────

  /**
   * Map SAML attribute names to platform fields.
   * Defaults: email → 'email' or 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
   *           displayName → 'displayName' or 'http://schemas.microsoft.com/identity/claims/displayname'
   */
  attributeMapping?: {
    email?: string;
    displayName?: string;
  };

  justInTimeProvisioning?: boolean;
}
