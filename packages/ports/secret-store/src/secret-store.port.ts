import type { Result } from 'neverthrow';

import type { SecretStoreError } from './errors.js';

export interface SecretStorePort {
  /** Retrieve a secret value by name. Returns undefined if the secret does not exist. */
  get(name: string): Promise<Result<string | undefined, SecretStoreError>>;

  /** List all secret names accessible to this store. */
  list(): Promise<Result<string[], SecretStoreError>>;

  /** Force a re-fetch of all cached secrets from the underlying store. */
  refresh(): Promise<Result<void, SecretStoreError>>;
}
