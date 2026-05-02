import type { Result } from 'neverthrow';

import type { IdentityError } from './errors.js';
import type { SessionRecord } from './types.js';

export interface SessionPort {
  create(
    userId: string,
    opts?: { ipAddress?: string; userAgent?: string; ttlSeconds?: number },
  ): Promise<Result<SessionRecord, IdentityError>>;
  findById(sessionId: string): Promise<Result<SessionRecord | null, IdentityError>>;
  refresh(sessionId: string): Promise<Result<SessionRecord, IdentityError>>;
  revoke(sessionId: string): Promise<Result<void, IdentityError>>;
  revokeAll(userId: string): Promise<Result<void, IdentityError>>;
}
