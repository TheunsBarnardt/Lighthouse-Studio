export interface OidcStateStore {
  set(key: string, value: string, expiresAt: Date): Promise<void>;
  get(key: string): Promise<string | null>;
  consume(key: string): Promise<boolean>;
}

export interface OidcAdapterConfig {
  /** Stable identifier matching the IdentityProviderPort metadata id. */
  id: string;
  displayName: string;
  iconUrl?: string;
  /** OIDC issuer URL — well-known discovery will be fetched from {issuer}/.well-known/openid-configuration */
  issuer: string;
  clientId: string;
  clientSecret: string;
  /** Registered callback/redirect URI. */
  redirectUri: string;
  /** HMAC secret for signing state tokens. Must be >= 32 bytes of entropy. */
  tokenSecret: string;
  /** OAuth scopes (default: ['openid', 'email', 'profile']). */
  scopes?: string[];
  /** Additional query params forwarded to the authorization endpoint. */
  extraParams?: Record<string, string>;
  /** Map OIDC claim names to platform fields. */
  claimMapping?: {
    email?: string;
    displayName?: string;
  };
  justInTimeProvisioning?: boolean;
  rpInitiatedLogout?: boolean;
}
