import type { Result } from 'neverthrow';

import type { PersistenceError } from './errors.js';
import type { MigrationRecord } from './types.js';

export interface SchemaMigrationPort {
  listApplied(): Promise<Result<MigrationRecord[], PersistenceError>>;

  apply(migration: {
    id: string;
    name: string;
    up: string;
    down?: string;
  }): Promise<Result<void, PersistenceError>>;

  revert(migrationId: string): Promise<Result<void, PersistenceError>>;

  isApplied(migrationId: string): Promise<Result<boolean, PersistenceError>>;
}
