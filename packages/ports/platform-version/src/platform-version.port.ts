import type { Result } from 'neverthrow';

import type { PlatformVersionError } from './errors.js';
import type { PlatformVersion, RecordVersionInput } from './types.js';

export interface PlatformVersionPort {
  /**
   * Returns the most recently recorded platform version for this database,
   * or null on a fresh install with no rows yet.
   */
  current(): Promise<Result<PlatformVersion | null, PlatformVersionError>>;

  /**
   * Returns the full history of recorded versions, newest first.
   */
  history(): Promise<Result<PlatformVersion[], PlatformVersionError>>;

  /**
   * Appends a new version row. Called after all schema migrations succeed.
   * The adapter supplies `appliedAt` from the database clock.
   */
  record(input: RecordVersionInput): Promise<Result<void, PlatformVersionError>>;

  /**
   * Removes the most recent version row (for rollback).
   * Returns the row that was removed so the caller can log it.
   * Errors with NOTHING_TO_ROLLBACK if there are no rows.
   */
  rollback(): Promise<Result<PlatformVersion, PlatformVersionError>>;
}
