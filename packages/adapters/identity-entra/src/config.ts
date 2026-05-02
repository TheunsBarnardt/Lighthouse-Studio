export interface EntraStateStore {
  set(key: string, value: string, expiresAt: Date): Promise<void>;
  get(key: string): Promise<string | null>;
  consume(key: string): Promise<boolean>;
}

export interface EntraAdapterConfig {
  /** Stable identifier matching the IdentityProviderPort metadata id. */
  id: string;
  displayName: string;
  iconUrl?: string;
  /**
   * Entra tenant identifier. Use:
   * - A specific tenant GUID for single-tenant apps
   * - 'organizations' for multi-tenant (work/school accounts only)
   * - 'common' for multi-tenant + personal Microsoft accounts
   */
  tenantId: string;
  clientId: string;
  clientSecret: string;
  /** Registered callback/redirect URI. */
  redirectUri: string;
  /** HMAC secret for signing state tokens. Must be >= 32 bytes of entropy. */
  tokenSecret: string;
  /**
   * Additional OAuth scopes beyond openid/email/profile.
   * Add 'https://graph.microsoft.com/GroupMember.Read.All' for group sync.
   */
  scopes?: string[];
  /**
   * When true, fetches group memberships from Microsoft Graph and includes
   * them in the claims. Requires the GroupMember.Read.All scope.
   */
  groupSync?: boolean;
  justInTimeProvisioning?: boolean;
}
