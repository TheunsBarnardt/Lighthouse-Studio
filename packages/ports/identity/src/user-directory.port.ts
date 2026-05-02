import type { Result } from 'neverthrow';

import type { IdentityError } from './errors.js';
import type { UserRecord } from './types.js';

export interface UserDirectoryPort {
  findById(id: string): Promise<Result<UserRecord | null, IdentityError>>;
  findByEmail(email: string): Promise<Result<UserRecord | null, IdentityError>>;
  findOrCreate(identity: {
    subject: string;
    email: string;
    displayName?: string;
    providerId: string;
  }): Promise<Result<UserRecord, IdentityError>>;
  update(
    id: string,
    changes: Partial<Pick<UserRecord, 'displayName' | 'avatarUrl' | 'metadata'>>,
  ): Promise<Result<UserRecord, IdentityError>>;
  archive(id: string): Promise<Result<void, IdentityError>>;
  list(opts?: {
    limit?: number;
    offset?: number;
  }): Promise<Result<{ items: UserRecord[]; total: number }, IdentityError>>;
}
