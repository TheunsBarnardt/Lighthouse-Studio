import type { Result } from 'neverthrow';

import type { IdentityError } from './errors.js';
import type { CreateSessionInput, Session } from './types.js';

export interface SessionPort {
  /**
   * Create a new session.
   * Returns both the Session record (with tokenHash) and the plaintext token
   * that must be given to the client. The plaintext token is never stored.
   */
  create(
    input: CreateSessionInput,
  ): Promise<Result<{ session: Session; token: string }, IdentityError>>;

  /** Look up a session by plaintext token (hashed for lookup). */
  findByToken(token: string): Promise<Result<Session | null, IdentityError>>;

  /** Update last_seen_at and extend the sliding expiry. */
  touch(sessionId: string): Promise<Result<Session, IdentityError>>;

  /**
   * Issue a new token and invalidate the old one (refresh token rotation).
   * Returns both the updated Session and the new plaintext token.
   */
  refresh(token: string): Promise<Result<{ session: Session; newToken: string }, IdentityError>>;

  /** Revoke a single session by its internal id. */
  revoke(sessionId: string): Promise<Result<void, IdentityError>>;

  /** Revoke all sessions for a user (e.g., on password change or admin action). */
  revokeAllForUser(userId: string): Promise<Result<void, IdentityError>>;

  /** List active (non-expired, non-revoked) sessions for a user. */
  listForUser(userId: string): Promise<Result<Session[], IdentityError>>;

  /** Remove expired sessions. Called by a scheduled cleanup job. */
  cleanupExpired(): Promise<Result<{ deleted: number }, IdentityError>>;
}
