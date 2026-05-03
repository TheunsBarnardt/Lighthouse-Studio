export interface AzureKeyVaultConfig {
  /** Full URI of the Key Vault (e.g. https://my-vault.vault.azure.net). */
  vaultUri: string;
  /** Prefix for secret names in Key Vault. Defaults to 'platform-'. */
  secretPrefix?: string;
  /** How long (ms) to cache secrets before triggering a refresh. Defaults to 3600000 (1 hour). */
  cacheTtlMs?: number;
}
