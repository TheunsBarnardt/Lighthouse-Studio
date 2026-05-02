import type { Result } from 'neverthrow';

import type { IdentityError } from './errors.js';
import type { MfaChallenge, MfaMethod } from './types.js';

export interface MfaPort {
  beginChallenge(userId: string, method: MfaMethod): Promise<Result<MfaChallenge, IdentityError>>;
  verifyChallenge(challengeId: string, code: string): Promise<Result<void, IdentityError>>;
  enroll(
    userId: string,
    method: MfaMethod,
  ): Promise<Result<{ secret?: string; qrCode?: string }, IdentityError>>;
  unenroll(userId: string, method: MfaMethod): Promise<Result<void, IdentityError>>;
  listEnrolled(userId: string): Promise<Result<MfaMethod[], IdentityError>>;
}
