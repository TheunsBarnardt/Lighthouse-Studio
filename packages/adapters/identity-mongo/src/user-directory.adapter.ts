import type {
  CreateUserInput,
  EncryptedSecret,
  Identity,
  IdentityError,
  PaginatedResult,
  ProfileUpdate,
  SearchOptions,
  User,
  UserDirectoryPort,
  VersionedHash,
} from '@platform/ports-identity';
import type { Collection, Db } from 'mongodb';
import type { Result } from 'neverthrow';

import { IdentityError as IE } from '@platform/ports-identity';
import { err, ok } from 'neverthrow';
import { randomUUID } from 'node:crypto';

// ── Constants ──────────────────────────────────────────────────────────────────

const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_MINUTES = 15;

// ── Document shapes (internal) ────────────────────────────────────────────────

interface IdentitySubDoc {
  provider_id: string;
  subject: string;
  email: string | null;
  email_verified: boolean;
  is_primary: boolean;
  linked_at: Date;
  last_used_at: Date | null;
}

interface UserDoc {
  _id: string;
  primary_email: string;
  email_verified: boolean;
  display_name: string | null;
  status: string;
  archived_at: Date | null;
  mfa_enabled: boolean;
  preferences: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
  identities: IdentitySubDoc[];
}

interface CredentialDoc {
  _id: string;
  password_hash: string | null;
  password_version: number | null;
  password_algorithm: string | null;
  mfa_ciphertext: string | null;
  mfa_key_version: string | null;
  recovery_codes: string[];
  failed_login_count: number;
  last_failed_login_at: Date | null;
  lockout_until: Date | null;
}

// ── Error mapping ──────────────────────────────────────────────────────────────

function mapMongoError(e: unknown): IdentityError {
  const code = (e as { code?: number }).code;
  if (code === 11000) {
    return new IE('CONFLICT', 'Unique constraint violation', e);
  }
  return new IE('PROVIDER_ERROR', `Database error: ${String(e)}`, e);
}

// ── Mappers ────────────────────────────────────────────────────────────────────

function mapIdentitySubDoc(d: IdentitySubDoc): Identity {
  return {
    providerId: d.provider_id,
    subject: d.subject,
    email: d.email,
    emailVerified: d.email_verified,
    primary: d.is_primary,
    linkedAt: d.linked_at,
    lastUsedAt: d.last_used_at,
  };
}

function mapUserDoc(doc: UserDoc): User {
  return {
    id: doc._id,
    primaryEmail: doc.primary_email,
    emailVerified: doc.email_verified,
    displayName: doc.display_name,
    status: doc.status as User['status'],
    archivedAt: doc.archived_at,
    mfaEnabled: doc.mfa_enabled,
    preferences: doc.preferences,
    createdAt: doc.created_at,
    updatedAt: doc.updated_at,
    identities: doc.identities.map(mapIdentitySubDoc),
  };
}

// ── Regex helper ───────────────────────────────────────────────────────────────

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── Adapter ────────────────────────────────────────────────────────────────────

/**
 * MongoDB implementation of UserDirectoryPort.
 *
 * Identities are embedded in the user document. A unique compound index on
 * (identities.provider_id, identities.subject) enforces cross-document
 * uniqueness. Credentials live in a separate `identity_credentials` collection
 * keyed by user _id.
 *
 * Recovery code comparison is exact string equality — the MFA layer is
 * responsible for hashing before calling setRecoveryCodes / consumeRecoveryCode.
 */
export class MongoUserDirectory implements UserDirectoryPort {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly users: Collection<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly credentials: Collection<any>;

  constructor(db: Db) {
    this.users = db.collection('identity_users');
    this.credentials = db.collection('identity_credentials');
  }

  // ── Lookup ──────────────────────────────────────────────────────────────────

  async findById(id: string): Promise<Result<User | null, IdentityError>> {
    try {
      const doc = (await this.users.findOne({ _id: id })) as UserDoc | null;
      return ok(doc ? mapUserDoc(doc) : null);
    } catch (e) {
      return err(mapMongoError(e));
    }
  }

  async findByEmail(email: string): Promise<Result<User | null, IdentityError>> {
    try {
      // eslint-disable-next-line security/detect-non-literal-regexp
      const emailRegex = new RegExp(`^${escapeRegex(email)}$`, 'i');
      const doc = (await this.users.findOne({
        primary_email: { $regex: emailRegex },
        status: { $ne: 'archived' },
      })) as UserDoc | null;
      return ok(doc ? mapUserDoc(doc) : null);
    } catch (e) {
      return err(mapMongoError(e));
    }
  }

  async findByIdentity(
    providerId: string,
    subject: string,
  ): Promise<Result<User | null, IdentityError>> {
    try {
      const doc = (await this.users.findOne({
        'identities.provider_id': providerId,
        'identities.subject': subject,
        status: { $ne: 'archived' },
      })) as UserDoc | null;
      return ok(doc ? mapUserDoc(doc) : null);
    } catch (e) {
      return err(mapMongoError(e));
    }
  }

  // ── Mutation ────────────────────────────────────────────────────────────────

  async create(input: CreateUserInput): Promise<Result<User, IdentityError>> {
    try {
      const now = new Date();
      const userId = randomUUID();

      // Enforce case-insensitive email uniqueness in application code
      // eslint-disable-next-line security/detect-non-literal-regexp
      const emailRegex = new RegExp(`^${escapeRegex(input.email)}$`, 'i');
      const emailConflict: unknown = await this.users.findOne({
        primary_email: { $regex: emailRegex },
      });
      if (emailConflict) {
        return err(new IE('CONFLICT', `Email already exists: ${input.email}`));
      }

      const identitySubDoc: IdentitySubDoc = {
        provider_id: input.identity.providerId,
        subject: input.identity.subject,
        email: input.identity.email ?? input.email,
        email_verified: input.identity.emailVerified ?? false,
        is_primary: input.identity.primary ?? true,
        linked_at: now,
        last_used_at: null,
      };

      const userDoc: UserDoc = {
        _id: userId,
        primary_email: input.email,
        email_verified: false,
        display_name: input.displayName ?? null,
        status: 'pending_verification',
        archived_at: null,
        mfa_enabled: false,
        preferences: (input.preferences ?? {}) as Record<string, unknown>,
        created_at: now,
        updated_at: now,
        identities: [identitySubDoc],
      };

      await this.users.insertOne(userDoc);

      const credDoc: CredentialDoc = {
        _id: userId,
        password_hash: null,
        password_version: null,
        password_algorithm: null,
        mfa_ciphertext: null,
        mfa_key_version: null,
        recovery_codes: [],
        failed_login_count: 0,
        last_failed_login_at: null,
        lockout_until: null,
      };
      await this.credentials.insertOne(credDoc);

      return ok(mapUserDoc(userDoc));
    } catch (e) {
      return err(mapMongoError(e));
    }
  }

  async linkIdentity(userId: string, identity: Identity): Promise<Result<void, IdentityError>> {
    try {
      const identitySubDoc: IdentitySubDoc = {
        provider_id: identity.providerId,
        subject: identity.subject,
        email: identity.email,
        email_verified: identity.emailVerified,
        is_primary: identity.primary,
        linked_at: identity.linkedAt,
        last_used_at: identity.lastUsedAt,
      };

      const result = await this.users.updateOne(
        { _id: userId },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
        { $push: { identities: identitySubDoc } } as any,
      );

      if (result.matchedCount === 0) {
        return err(new IE('ACCOUNT_NOT_FOUND', `User not found: ${userId}`));
      }
      return ok(undefined);
    } catch (e) {
      return err(mapMongoError(e));
    }
  }

  async unlinkIdentity(userId: string, providerId: string): Promise<Result<void, IdentityError>> {
    try {
      const doc = (await this.users.findOne({ _id: userId })) as UserDoc | null;
      if (!doc) {
        return err(new IE('ACCOUNT_NOT_FOUND', `User not found: ${userId}`));
      }
      if (doc.identities.length <= 1) {
        return err(new IE('INVALID_STATE', 'Cannot unlink the last identity from a user'));
      }

      await this.users.updateOne(
        { _id: userId },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
        { $pull: { identities: { provider_id: providerId } } } as any,
      );
      return ok(undefined);
    } catch (e) {
      return err(mapMongoError(e));
    }
  }

  async updateProfile(
    userId: string,
    changes: ProfileUpdate,
  ): Promise<Result<User, IdentityError>> {
    try {
      const setFields: Record<string, unknown> = { updated_at: new Date() };
      if (changes.displayName !== undefined) setFields['display_name'] = changes.displayName;
      if (changes.preferences !== undefined) {
        for (const [k, v] of Object.entries(changes.preferences)) {
          setFields[`preferences.${k}`] = v;
        }
      }

      const result = (await this.users.findOneAndUpdate(
        { _id: userId },
        { $set: setFields },
        { returnDocument: 'after' },
      )) as UserDoc | null;

      if (!result) {
        return err(new IE('ACCOUNT_NOT_FOUND', `User ${userId} not found`));
      }
      return ok(mapUserDoc(result));
    } catch (e) {
      return err(mapMongoError(e));
    }
  }

  async archive(userId: string): Promise<Result<void, IdentityError>> {
    try {
      await this.users.updateOne(
        { _id: userId },
        { $set: { status: 'archived', archived_at: new Date(), updated_at: new Date() } },
      );
      return ok(undefined);
    } catch (e) {
      return err(mapMongoError(e));
    }
  }

  async restore(userId: string): Promise<Result<User, IdentityError>> {
    try {
      const result = (await this.users.findOneAndUpdate(
        { _id: userId },
        { $set: { status: 'active', archived_at: null, updated_at: new Date() } },
        { returnDocument: 'after' },
      )) as UserDoc | null;
      if (!result) {
        return err(new IE('ACCOUNT_NOT_FOUND', `User ${userId} not found`));
      }
      return ok(mapUserDoc(result));
    } catch (e) {
      return err(mapMongoError(e));
    }
  }

  async hardDelete(userId: string): Promise<Result<void, IdentityError>> {
    try {
      await this.users.deleteOne({ _id: userId });
      await this.credentials.deleteOne({ _id: userId });
      return ok(undefined);
    } catch (e) {
      return err(mapMongoError(e));
    }
  }

  async search(opts: SearchOptions): Promise<Result<PaginatedResult<User>, IdentityError>> {
    try {
      const filter: Record<string, unknown> = {};
      if (opts.status && opts.status !== 'all') filter['status'] = opts.status;
      if (opts.query) {
        // eslint-disable-next-line security/detect-non-literal-regexp
        const re = new RegExp(escapeRegex(opts.query), 'i');
        filter['$or'] = [{ primary_email: re }, { display_name: re }];
      }

      const total = await this.users.countDocuments(filter);
      const offset = opts.offset ?? 0;
      const limit = opts.limit ?? 50;

      const docs = (await this.users
        .find(filter)
        .sort({ created_at: 1 })
        .skip(offset)
        .limit(limit)
        .toArray()) as UserDoc[];

      return ok({ items: docs.map(mapUserDoc), total });
    } catch (e) {
      return err(mapMongoError(e));
    }
  }

  // ── MFA / credentials ───────────────────────────────────────────────────────

  async setMfaSecret(
    userId: string,
    secret: EncryptedSecret,
  ): Promise<Result<void, IdentityError>> {
    try {
      await this.ensureCredentials(userId);
      await this.credentials.updateOne(
        { _id: userId },
        {
          $set: {
            mfa_ciphertext: secret.ciphertext || null,
            mfa_key_version: secret.keyVersion || null,
          },
        },
      );
      const enabled = secret.ciphertext !== '';
      await this.users.updateOne(
        { _id: userId },
        { $set: { mfa_enabled: enabled, updated_at: new Date() } },
      );
      return ok(undefined);
    } catch (e) {
      return err(mapMongoError(e));
    }
  }

  async getMfaSecret(userId: string): Promise<Result<EncryptedSecret | null, IdentityError>> {
    try {
      const doc = (await this.credentials.findOne(
        { _id: userId },
        { projection: { mfa_ciphertext: 1, mfa_key_version: 1 } },
      )) as Pick<CredentialDoc, '_id' | 'mfa_ciphertext' | 'mfa_key_version'> | null;
      if (!doc?.mfa_ciphertext) return ok(null);
      return ok({ ciphertext: doc.mfa_ciphertext, keyVersion: doc.mfa_key_version ?? 'v1' });
    } catch (e) {
      return err(mapMongoError(e));
    }
  }

  async setRecoveryCodes(
    userId: string,
    hashedCodes: string[],
  ): Promise<Result<void, IdentityError>> {
    try {
      await this.ensureCredentials(userId);
      await this.credentials.updateOne({ _id: userId }, { $set: { recovery_codes: hashedCodes } });
      return ok(undefined);
    } catch (e) {
      return err(mapMongoError(e));
    }
  }

  async consumeRecoveryCode(userId: string, code: string): Promise<Result<boolean, IdentityError>> {
    try {
      // findOneAndUpdate is atomic: only pulls the code if it exists
      const before: unknown = await this.credentials.findOneAndUpdate(
        { _id: userId, recovery_codes: code },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
        { $pull: { recovery_codes: code } } as any,
        { returnDocument: 'before' },
      );
      return ok(before !== null);
    } catch (e) {
      return err(mapMongoError(e));
    }
  }

  async setPasswordHash(userId: string, hash: VersionedHash): Promise<Result<void, IdentityError>> {
    try {
      await this.ensureCredentials(userId);
      await this.credentials.updateOne(
        { _id: userId },
        {
          $set: {
            password_hash: hash.hash,
            password_version: hash.version,
            password_algorithm: hash.algorithm,
          },
        },
      );
      return ok(undefined);
    } catch (e) {
      return err(mapMongoError(e));
    }
  }

  async getPasswordHash(userId: string): Promise<Result<VersionedHash | null, IdentityError>> {
    try {
      const doc = (await this.credentials.findOne(
        { _id: userId },
        { projection: { password_hash: 1, password_version: 1, password_algorithm: 1 } },
      )) as Pick<
        CredentialDoc,
        '_id' | 'password_hash' | 'password_version' | 'password_algorithm'
      > | null;
      if (!doc?.password_hash) return ok(null);
      return ok({
        hash: doc.password_hash,
        version: doc.password_version ?? 1,
        algorithm: (doc.password_algorithm ?? 'argon2id') as 'argon2id',
      });
    } catch (e) {
      return err(mapMongoError(e));
    }
  }

  // ── Lockout ─────────────────────────────────────────────────────────────────

  async recordFailedLogin(
    userId: string,
    _ipAddress: string,
  ): Promise<Result<void, IdentityError>> {
    try {
      await this.ensureCredentials(userId);
      const doc = (await this.credentials.findOneAndUpdate(
        { _id: userId },
        { $inc: { failed_login_count: 1 }, $set: { last_failed_login_at: new Date() } },
        { returnDocument: 'after' },
      )) as CredentialDoc | null;
      if (doc && doc.failed_login_count >= LOCKOUT_THRESHOLD && !doc.lockout_until) {
        const until = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1_000);
        await this.credentials.updateOne({ _id: userId }, { $set: { lockout_until: until } });
      }
      return ok(undefined);
    } catch (e) {
      return err(mapMongoError(e));
    }
  }

  async resetFailedLogins(userId: string): Promise<Result<void, IdentityError>> {
    try {
      await this.credentials.updateOne(
        { _id: userId },
        { $set: { failed_login_count: 0, last_failed_login_at: null, lockout_until: null } },
      );
      return ok(undefined);
    } catch (e) {
      return err(mapMongoError(e));
    }
  }

  async isLockedOut(
    userId: string,
  ): Promise<Result<{ locked: boolean; until?: Date }, IdentityError>> {
    try {
      const doc = (await this.credentials.findOne(
        { _id: userId },
        { projection: { lockout_until: 1 } },
      )) as Pick<CredentialDoc, '_id' | 'lockout_until'> | null;
      if (!doc) return ok({ locked: false });
      const until = doc.lockout_until;
      if (!until || until <= new Date()) return ok({ locked: false });
      return ok({ locked: true, until });
    } catch (e) {
      return err(mapMongoError(e));
    }
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private async ensureCredentials(userId: string): Promise<void> {
    await this.credentials.updateOne(
      { _id: userId },
      {
        $setOnInsert: {
          _id: userId,
          password_hash: null,
          password_version: null,
          password_algorithm: null,
          mfa_ciphertext: null,
          mfa_key_version: null,
          recovery_codes: [],
          failed_login_count: 0,
          last_failed_login_at: null,
          lockout_until: null,
        },
      },
      { upsert: true },
    );
  }
}
