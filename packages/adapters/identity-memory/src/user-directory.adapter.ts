import type {
  CreateUserInput,
  EncryptedSecret,
  Identity,
  PaginatedResult,
  ProfileUpdate,
  SearchOptions,
  User,
  UserDirectoryPort,
  VersionedHash,
} from '@platform/ports-identity';
import type { Result } from 'neverthrow';

import { IdentityError } from '@platform/ports-identity';
import { err, ok } from 'neverthrow';

interface CredentialStore {
  passwordHash: VersionedHash | null;
  mfaSecret: EncryptedSecret | null;
  recoveryCodes: string[];
  failedLoginCount: number;
  lockedUntil: Date | null;
}

const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_MINUTES = 15;

export class InMemoryUserDirectory implements UserDirectoryPort {
  private readonly users = new Map<string, User>();
  private readonly credentials = new Map<string, CredentialStore>();

  private creds(userId: string): CredentialStore {
    let c = this.credentials.get(userId);
    if (!c) {
      c = {
        passwordHash: null,
        mfaSecret: null,
        recoveryCodes: [],
        failedLoginCount: 0,
        lockedUntil: null,
      };
      this.credentials.set(userId, c);
    }
    return c;
  }

  private findUserByField(predicate: (u: User) => boolean, includeArchived = false): User | null {
    for (const u of this.users.values()) {
      if (!includeArchived && u.status === 'archived') continue;
      if (predicate(u)) return u;
    }
    return null;
  }

  findById(id: string): Promise<Result<User | null, IdentityError>> {
    return Promise.resolve(ok(this.users.get(id) ?? null));
  }

  findByEmail(email: string): Promise<Result<User | null, IdentityError>> {
    return Promise.resolve(ok(this.findUserByField((u) => u.primaryEmail === email)));
  }

  findByIdentity(providerId: string, subject: string): Promise<Result<User | null, IdentityError>> {
    return Promise.resolve(
      ok(
        this.findUserByField((u) =>
          u.identities.some((i) => i.providerId === providerId && i.subject === subject),
        ),
      ),
    );
  }

  create(input: CreateUserInput): Promise<Result<User, IdentityError>> {
    // Duplicate email check
    if (this.findUserByField((u) => u.primaryEmail === input.email, true)) {
      return Promise.resolve(
        err(new IdentityError('CONFLICT', `Email already exists: ${input.email}`)),
      );
    }
    // Duplicate identity check
    const { providerId, subject } = input.identity;
    if (
      this.findUserByField(
        (u) => u.identities.some((i) => i.providerId === providerId && i.subject === subject),
        true,
      )
    ) {
      return Promise.resolve(
        err(new IdentityError('CONFLICT', `Identity already exists: ${providerId}:${subject}`)),
      );
    }

    const now = new Date();
    const user: User = {
      id: crypto.randomUUID(),
      primaryEmail: input.email,
      emailVerified: false,
      displayName: input.displayName ?? null,
      status: 'pending_verification',
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
      identities: [
        {
          providerId: input.identity.providerId,
          subject: input.identity.subject,
          email: input.identity.email ?? input.email,
          emailVerified: input.identity.emailVerified ?? false,
          primary: input.identity.primary ?? true,
          linkedAt: now,
          lastUsedAt: null,
        },
      ],
      mfaEnabled: false,
      preferences: input.preferences ?? {},
    };
    this.users.set(user.id, user);
    return Promise.resolve(ok(user));
  }

  linkIdentity(userId: string, identity: Identity): Promise<Result<void, IdentityError>> {
    const user = this.users.get(userId);
    if (!user)
      return Promise.resolve(
        err(new IdentityError('ACCOUNT_NOT_FOUND', `User not found: ${userId}`)),
      );

    // Check if this (provider, subject) is already taken by another user
    const existing = this.findUserByField(
      (u) =>
        u.id !== userId &&
        u.identities.some(
          (i) => i.providerId === identity.providerId && i.subject === identity.subject,
        ),
      true,
    );
    if (existing)
      return Promise.resolve(
        err(
          new IdentityError(
            'CONFLICT',
            `Identity ${identity.providerId}:${identity.subject} is already linked to another user`,
          ),
        ),
      );

    const updated: User = {
      ...user,
      identities: [...user.identities, identity],
      updatedAt: new Date(),
    };
    this.users.set(userId, updated);
    return Promise.resolve(ok(undefined));
  }

  unlinkIdentity(userId: string, providerId: string): Promise<Result<void, IdentityError>> {
    const user = this.users.get(userId);
    if (!user)
      return Promise.resolve(
        err(new IdentityError('ACCOUNT_NOT_FOUND', `User not found: ${userId}`)),
      );

    if (user.identities.length <= 1) {
      return Promise.resolve(
        err(new IdentityError('INVALID_STATE', 'Cannot unlink the last identity from a user')),
      );
    }

    const updated: User = {
      ...user,
      identities: user.identities.filter((i) => i.providerId !== providerId),
      updatedAt: new Date(),
    };
    this.users.set(userId, updated);
    return Promise.resolve(ok(undefined));
  }

  updateProfile(userId: string, changes: ProfileUpdate): Promise<Result<User, IdentityError>> {
    const user = this.users.get(userId);
    if (!user)
      return Promise.resolve(
        err(new IdentityError('ACCOUNT_NOT_FOUND', `User not found: ${userId}`)),
      );

    const updated: User = {
      ...user,
      ...(changes.displayName !== undefined ? { displayName: changes.displayName } : {}),
      preferences: { ...user.preferences, ...changes.preferences },
      updatedAt: new Date(),
    };
    this.users.set(userId, updated);
    return Promise.resolve(ok(updated));
  }

  archive(userId: string): Promise<Result<void, IdentityError>> {
    const user = this.users.get(userId);
    if (!user)
      return Promise.resolve(
        err(new IdentityError('ACCOUNT_NOT_FOUND', `User not found: ${userId}`)),
      );

    const now = new Date();
    this.users.set(userId, { ...user, status: 'archived', archivedAt: now, updatedAt: now });
    return Promise.resolve(ok(undefined));
  }

  restore(userId: string): Promise<Result<User, IdentityError>> {
    const user = this.users.get(userId);
    if (!user)
      return Promise.resolve(
        err(new IdentityError('ACCOUNT_NOT_FOUND', `User not found: ${userId}`)),
      );

    const restored: User = {
      ...user,
      status: 'active',
      archivedAt: null,
      updatedAt: new Date(),
    };
    this.users.set(userId, restored);
    return Promise.resolve(ok(restored));
  }

  hardDelete(userId: string): Promise<Result<void, IdentityError>> {
    this.users.delete(userId);
    this.credentials.delete(userId);
    return Promise.resolve(ok(undefined));
  }

  search(opts: SearchOptions): Promise<Result<PaginatedResult<User>, IdentityError>> {
    const status = opts.status ?? 'active';
    let all = [...this.users.values()];

    if (status !== 'all') {
      all = all.filter((u) => u.status === status);
    }

    if (opts.query) {
      const q = opts.query.toLowerCase();
      all = all.filter(
        (u) =>
          u.primaryEmail.toLowerCase().includes(q) ||
          (u.displayName?.toLowerCase().includes(q) ?? false),
      );
    }

    const total = all.length;
    const offset = opts.offset ?? 0;
    const limit = opts.limit ?? 20;
    return Promise.resolve(ok({ items: all.slice(offset, offset + limit), total }));
  }

  // ── MFA secrets ─────────────────────────────────────────────────────────────

  setMfaSecret(userId: string, secret: EncryptedSecret): Promise<Result<void, IdentityError>> {
    this.creds(userId).mfaSecret = secret;
    return Promise.resolve(ok(undefined));
  }

  getMfaSecret(userId: string): Promise<Result<EncryptedSecret | null, IdentityError>> {
    return Promise.resolve(ok(this.creds(userId).mfaSecret));
  }

  setRecoveryCodes(userId: string, hashedCodes: string[]): Promise<Result<void, IdentityError>> {
    this.creds(userId).recoveryCodes = [...hashedCodes];
    return Promise.resolve(ok(undefined));
  }

  consumeRecoveryCode(userId: string, hashedCode: string): Promise<Result<boolean, IdentityError>> {
    const c = this.creds(userId);
    const idx = c.recoveryCodes.indexOf(hashedCode);
    if (idx === -1) return Promise.resolve(ok(false));
    c.recoveryCodes.splice(idx, 1);
    return Promise.resolve(ok(true));
  }

  // ── Password storage ────────────────────────────────────────────────────────

  setPasswordHash(userId: string, hash: VersionedHash): Promise<Result<void, IdentityError>> {
    this.creds(userId).passwordHash = hash;
    return Promise.resolve(ok(undefined));
  }

  getPasswordHash(userId: string): Promise<Result<VersionedHash | null, IdentityError>> {
    return Promise.resolve(ok(this.creds(userId).passwordHash));
  }

  recordFailedLogin(userId: string, _ipAddress: string): Promise<Result<void, IdentityError>> {
    const c = this.creds(userId);
    c.failedLoginCount += 1;
    if (c.failedLoginCount >= LOCKOUT_THRESHOLD) {
      const until = new Date();
      until.setMinutes(until.getMinutes() + LOCKOUT_MINUTES);
      c.lockedUntil = until;
    }
    return Promise.resolve(ok(undefined));
  }

  resetFailedLogins(userId: string): Promise<Result<void, IdentityError>> {
    const c = this.creds(userId);
    c.failedLoginCount = 0;
    c.lockedUntil = null;
    return Promise.resolve(ok(undefined));
  }

  isLockedOut(userId: string): Promise<Result<{ locked: boolean; until?: Date }, IdentityError>> {
    const c = this.creds(userId);
    if (!c.lockedUntil) return Promise.resolve(ok({ locked: false }));
    if (c.lockedUntil <= new Date()) {
      // Lockout has expired
      c.lockedUntil = null;
      c.failedLoginCount = 0;
      return Promise.resolve(ok({ locked: false }));
    }
    return Promise.resolve(ok({ locked: true, until: c.lockedUntil }));
  }
}
