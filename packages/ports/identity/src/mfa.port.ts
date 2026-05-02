import type { Result } from 'neverthrow';

import type { IdentityError } from './errors.js';
import type { RecoveryCodes, TotpEnrollment } from './types.js';

export interface MfaPort {
  /**
   * Generate a new TOTP secret for a user and begin the enrollment flow.
   * The secret is stored in a pending state until confirmEnrollment succeeds.
   * Enrollment expires after 10 minutes (per Objective 5 spec).
   */
  generateTotpSecret(userId: string): Promise<Result<TotpEnrollment, IdentityError>>;

  /**
   * Confirm the enrollment by verifying a code the user enters from their
   * authenticator app. On success, generates and returns recovery codes.
   * On failure or timeout, the pending secret is discarded.
   */
  confirmEnrollment(userId: string, code: string): Promise<Result<RecoveryCodes, IdentityError>>;

  /** Verify a TOTP code during sign-in. Accepts ±1 time window for clock skew. */
  verifyTotp(userId: string, code: string): Promise<Result<void, IdentityError>>;

  /**
   * Verify a recovery code during sign-in.
   * Single-use: the code is consumed on success.
   */
  verifyRecoveryCode(userId: string, code: string): Promise<Result<void, IdentityError>>;

  /** Disable MFA for a user. Requires re-authentication at the service layer before calling. */
  disable(userId: string): Promise<Result<void, IdentityError>>;

  /** Generate a new set of recovery codes, invalidating the old set. */
  regenerateRecoveryCodes(userId: string): Promise<Result<RecoveryCodes, IdentityError>>;
}
