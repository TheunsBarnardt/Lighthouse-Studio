import type { SecretStorePort } from '@platform/ports-config';
import type { Result } from 'neverthrow';

import { ConfigError } from '@platform/ports-config';
import { err, ok } from 'neverthrow';

export class InMemorySecretStore implements SecretStorePort {
  private readonly secrets = new Map<string, string>();

  constructor(initial?: Record<string, string>) {
    if (initial) {
      for (const [k, v] of Object.entries(initial)) {
        this.secrets.set(k, v);
      }
    }
  }

  get(key: string): Promise<Result<string, ConfigError>> {
    const value = this.secrets.get(key);
    if (value === undefined) {
      return Promise.resolve(err(new ConfigError('SECRET_NOT_FOUND', `Secret not found: ${key}`)));
    }
    return Promise.resolve(ok(value));
  }

  set(key: string, value: string): Promise<Result<void, ConfigError>> {
    this.secrets.set(key, value);
    return Promise.resolve(ok(undefined));
  }

  delete(key: string): Promise<Result<void, ConfigError>> {
    this.secrets.delete(key);
    return Promise.resolve(ok(undefined));
  }

  list(): Promise<Result<string[], ConfigError>> {
    return Promise.resolve(ok(Array.from(this.secrets.keys())));
  }
}
