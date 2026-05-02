import type { Result } from 'neverthrow';

import type { IdentityError } from './errors.js';
import type {
  CreateUserInput,
  EncryptedSecret,
  Identity,
  PaginatedResult,
  ProfileUpdate,
  SearchOptions,
  User,
  VersionedHash,
} from './types.js';

export interface UserDirectoryPort {
  // ── Lookup ────────────────────────────────────────────────────────────────

  findById(id: string): Promise<Result<User | null, IdentityError>>;
  findByEmail(email: string): Promise<Result<User | null, IdentityError>>;
  findByIdentity(providerId: string, subject: string): Promise<Result<User | null, IdentityError>>;

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  /** Create a new user with one initial identity. */
  create(input: CreateUserInput): Promise<Result<User, IdentityError>>;

  /** Link an additional identity to an existing user. */
  linkIdentity(userId: string, identity: Identity): Promise<Result<void, IdentityError>>;

  /** Unlink an identity. The user must retain at least one identity. */
  unlinkIdentity(userId: string, providerId: string): Promise<Result<void, IdentityError>>;

  /** Update the user's profile (display name, preferences). */
  updateProfile(userId: string, changes: ProfileUpdate): Promise<Result<User, IdentityError>>;

  /** Soft-delete. Archived users cannot sign in. */
  archive(userId: string): Promise<Result<void, IdentityError>>;

  /** Restore a soft-deleted user. */
  restore(userId: string): Promise<Result<User, IdentityError>>;

  /**
   * Hard-delete (permanent). For GDPR right-to-erasure after the retention
   * period has passed. The user_id becomes an orphaned reference in audit logs.
   */
  hardDelete(userId: string): Promise<Result<void, IdentityError>>;

  /** Search users (admin tooling). */
  search(opts: SearchOptions): Promise<Result<PaginatedResult<User>, IdentityError>>;

  // ── MFA secret storage ────────────────────────────────────────────────────

  setMfaSecret(userId: string, secret: EncryptedSecret): Promise<Result<void, IdentityError>>;

  getMfaSecret(userId: string): Promise<Result<EncryptedSecret | null, IdentityError>>;

  setRecoveryCodes(userId: string, hashedCodes: string[]): Promise<Result<void, IdentityError>>;

  /** Returns true if the code matched and was consumed; false if not found. */
  consumeRecoveryCode(userId: string, hashedCode: string): Promise<Result<boolean, IdentityError>>;

  // ── Password / credential storage (built-in auth only) ───────────────────

  setPasswordHash(userId: string, hash: VersionedHash): Promise<Result<void, IdentityError>>;
  getPasswordHash(userId: string): Promise<Result<VersionedHash | null, IdentityError>>;

  /** Increment the failed login counter and set lockout if threshold is crossed. */
  recordFailedLogin(userId: string, ipAddress: string): Promise<Result<void, IdentityError>>;

  /** Reset the failed login counter after a successful sign-in. */
  resetFailedLogins(userId: string): Promise<Result<void, IdentityError>>;

  /** Check whether the account or IP is currently locked out. */
  isLockedOut(userId: string): Promise<Result<{ locked: boolean; until?: Date }, IdentityError>>;
}
