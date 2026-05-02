import type { Result } from 'neverthrow';

import type { ConfigError } from './errors.js';

export interface SecretStorePort {
  get(key: string): Promise<Result<string, ConfigError>>;
  set(key: string, value: string): Promise<Result<void, ConfigError>>;
  delete(key: string): Promise<Result<void, ConfigError>>;
  list(): Promise<Result<string[], ConfigError>>;
}
