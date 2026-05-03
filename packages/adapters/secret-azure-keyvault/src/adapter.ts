/* eslint-disable @typescript-eslint/no-unsafe-call */
import type { SecretStorePort } from '@platform/ports-secret-store';
import type { Result } from 'neverthrow';

import { SecretStoreError } from '@platform/ports-secret-store';
import { err, ok } from 'neverthrow';

import type { AzureKeyVaultConfig } from './config.js';

const DEFAULT_PREFIX = 'platform-';
const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Secret store backed by Azure Key Vault.
 *
 * Authenticates via DefaultAzureCredential (managed identity → environment →
 * workload identity chain). Reads all secrets at startup and caches them for
 * cacheTtlMs. Call refresh() before a planned service restart to pick up
 * rotated secrets.
 *
 * See ADR-0088 for the deployment model and limitations.
 */
export class AzureKeyVaultSecretStore implements SecretStorePort {
  private readonly prefix: string;
  private readonly cacheTtlMs: number;
  private cache: Map<string, string> = new Map();
  private lastFetchAt = 0;

  constructor(private readonly config: AzureKeyVaultConfig) {
    this.prefix = config.secretPrefix ?? DEFAULT_PREFIX;
    this.cacheTtlMs = config.cacheTtlMs ?? DEFAULT_TTL_MS;
  }

  async get(name: string): Promise<Result<string | undefined, SecretStoreError>> {
    const fetchResult = await this.ensureCacheWarm();
    if (fetchResult.isErr()) return err(fetchResult.error);
    return ok(this.cache.get(name));
  }

  async list(): Promise<Result<string[], SecretStoreError>> {
    const fetchResult = await this.ensureCacheWarm();
    if (fetchResult.isErr()) return err(fetchResult.error);
    return ok([...this.cache.keys()]);
  }

  async refresh(): Promise<Result<void, SecretStoreError>> {
    return this.fetchAllSecrets();
  }

  private async ensureCacheWarm(): Promise<Result<void, SecretStoreError>> {
    if (this.lastFetchAt === 0 || Date.now() - this.lastFetchAt > this.cacheTtlMs) {
      return this.fetchAllSecrets();
    }
    return ok(undefined);
  }

  private async fetchAllSecrets(): Promise<Result<void, SecretStoreError>> {
    try {
      // Dynamic import so this adapter compiles without @azure/keyvault-secrets
      // when running in environments that haven't installed the Azure SDK.
      const { DefaultAzureCredential } = await import('@azure/identity');
      const { SecretClient } = await import('@azure/keyvault-secrets');

      const credential = new DefaultAzureCredential();
      const client = new SecretClient(this.config.vaultUri, credential);

      const newCache = new Map<string, string>();
      for await (const secretProperties of client.listPropertiesOfSecrets()) {
        const name = secretProperties.name;
        if (!name.startsWith(this.prefix)) continue;
        const platformName = name.slice(this.prefix.length);
        const secret = await client.getSecret(name);
        if (secret.value !== undefined) {
          newCache.set(platformName, secret.value);
        }
      }

      this.cache = newCache;
      this.lastFetchAt = Date.now();
      return ok(undefined);
    } catch (cause) {
      return err(
        new SecretStoreError(
          `Failed to fetch secrets from Azure Key Vault (${this.config.vaultUri})`,
          cause,
        ),
      );
    }
  }
}
