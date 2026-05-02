import type {
  CreateUserInput,
  EncryptedSecret,
  IdentityError,
  PaginatedResult,
  ProfileUpdate,
  SearchOptions,
  User,
  UserDirectoryPort,
  UserPreferences,
  VersionedHash,
  Identity,
} from '@platform/ports-identity';
import type { Result } from 'neverthrow';
import type { Pool, PoolClient } from 'pg';

import { verify as argonVerify } from '@node-rs/argon2';
import { IdentityError as IE } from '@platform/ports-identity';
import { err, ok } from 'neverthrow';

// ── DB row types ──────────────────────────────────────────────────────────────

interface UserRow {
  id: string;
  primary_email: string;
  email_verified: boolean;
  display_name: string | null;
  status: string;
  archived_at: Date | null;
  mfa_enabled: boolean;
  preferences: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

interface IdentityRow {
  id: string;
  user_id: string;
  provider_id: string;
  subject: string;
  email: string | null;
  email_verified: boolean;
  is_primary: boolean;
  linked_at: Date;
  last_used_at: Date | null;
}

interface CredentialRow {
  user_id: string;
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

// ── Lockout constants ──────────────────────────────────────────────────────────

const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_MINUTES = 15;

// ── Mappers ───────────────────────────────────────────────────────────────────

function mapIdentityRow(row: IdentityRow): Identity {
  return {
    providerId: row.provider_id,
    subject: row.subject,
    email: row.email,
    emailVerified: row.email_verified,
    primary: row.is_primary,
    linkedAt: row.linked_at,
    lastUsedAt: row.last_used_at,
  };
}

function mapUserRow(row: UserRow, identities: IdentityRow[]): User {
  const prefs = row.preferences as UserPreferences;
  return {
    id: row.id,
    primaryEmail: row.primary_email,
    emailVerified: row.email_verified,
    displayName: row.display_name,
    status: row.status as User['status'],
    archivedAt: row.archived_at,
    mfaEnabled: row.mfa_enabled,
    preferences: prefs,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    identities: identities.map(mapIdentityRow),
  };
}

function mapDbError(e: unknown): IdentityError {
  const code = (e as { code?: string }).code;
  if (code === '23505') {
    return new IE('CONFLICT', 'A user with that email already exists', e);
  }
  return new IE('PROVIDER_ERROR', `Database error: ${String(e)}`, e);
}

// ── Helper: ensure credentials row exists ─────────────────────────────────────

async function ensureCredentials(client: PoolClient | Pool, userId: string): Promise<void> {
  await (client as Pool).query(
    `INSERT INTO identity_credentials (user_id)
     VALUES ($1)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId],
  );
}

// ── Adapter ───────────────────────────────────────────────────────────────────

/**
 * PostgreSQL implementation of UserDirectoryPort.
 *
 * Stores users, federated identities, credentials (passwords, MFA secrets,
 * recovery codes), and lockout state in Postgres.
 *
 * Recovery code verification uses argon2id — the BuiltinMfaAdapter passes
 * plaintext recovery codes to consumeRecoveryCode, and this adapter iterates
 * stored argon2id hashes to find the match before removing it.
 */
export class PostgresUserDirectory implements UserDirectoryPort {
  constructor(private readonly pool: Pool) {}

  // ── Lookup ──────────────────────────────────────────────────────────────────

  async findById(id: string): Promise<Result<User | null, IdentityError>> {
    try {
      const { rows } = await this.pool.query<UserRow>(
        'SELECT * FROM identity_users WHERE id = $1',
        [id],
      );
      const row = rows[0];
      if (!row) return ok(null);
      return ok(await this.hydrateUser(row));
    } catch (e) {
      return err(mapDbError(e));
    }
  }

  async findByEmail(email: string): Promise<Result<User | null, IdentityError>> {
    try {
      const { rows } = await this.pool.query<UserRow>(
        `SELECT * FROM identity_users
         WHERE LOWER(primary_email) = LOWER($1) AND status != 'archived'`,
        [email],
      );
      const row = rows[0];
      if (!row) return ok(null);
      return ok(await this.hydrateUser(row));
    } catch (e) {
      return err(mapDbError(e));
    }
  }

  async findByIdentity(
    providerId: string,
    subject: string,
  ): Promise<Result<User | null, IdentityError>> {
    try {
      const { rows } = await this.pool.query<{ user_id: string }>(
        'SELECT user_id FROM identity_identities WHERE provider_id = $1 AND subject = $2',
        [providerId, subject],
      );
      const identityRow = rows[0];
      if (!identityRow) return ok(null);
      return await this.findById(identityRow.user_id);
    } catch (e) {
      return err(mapDbError(e));
    }
  }

  // ── Mutation ────────────────────────────────────────────────────────────────

  async create(input: CreateUserInput): Promise<Result<User, IdentityError>> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const { rows } = await client.query<UserRow>(
        `INSERT INTO identity_users (primary_email, email_verified, display_name, preferences)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [
          input.email,
          input.identity.emailVerified ?? false,
          input.displayName ?? null,
          JSON.stringify(input.preferences ?? {}),
        ],
      );
      const user = rows[0];
      if (!user) {
        await client.query('ROLLBACK');
        return err(new IE('PROVIDER_ERROR', 'User INSERT returned no row'));
      }

      await client.query(
        `INSERT INTO identity_identities
           (user_id, provider_id, subject, email, email_verified, is_primary)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          user.id,
          input.identity.providerId,
          input.identity.subject,
          input.identity.email ?? input.email,
          input.identity.emailVerified ?? false,
          input.identity.primary ?? true,
        ],
      );

      await client.query('INSERT INTO identity_credentials (user_id) VALUES ($1)', [user.id]);

      await client.query('COMMIT');
      return ok(await this.hydrateUserWithClient(client, user));
    } catch (e) {
      await client.query('ROLLBACK');
      return err(mapDbError(e));
    } finally {
      client.release();
    }
  }

  async linkIdentity(userId: string, identity: Identity): Promise<Result<void, IdentityError>> {
    try {
      await this.pool.query(
        `INSERT INTO identity_identities
           (user_id, provider_id, subject, email, email_verified, is_primary, linked_at, last_used_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (provider_id, subject) DO UPDATE
           SET email = EXCLUDED.email,
               email_verified = EXCLUDED.email_verified,
               last_used_at = EXCLUDED.last_used_at`,
        [
          userId,
          identity.providerId,
          identity.subject,
          identity.email,
          identity.emailVerified,
          identity.primary,
          identity.linkedAt,
          identity.lastUsedAt,
        ],
      );
      return ok(undefined);
    } catch (e) {
      return err(mapDbError(e));
    }
  }

  async unlinkIdentity(userId: string, providerId: string): Promise<Result<void, IdentityError>> {
    try {
      await this.pool.query(
        'DELETE FROM identity_identities WHERE user_id = $1 AND provider_id = $2',
        [userId, providerId],
      );
      return ok(undefined);
    } catch (e) {
      return err(mapDbError(e));
    }
  }

  async updateProfile(
    userId: string,
    changes: ProfileUpdate,
  ): Promise<Result<User, IdentityError>> {
    try {
      const sets: string[] = ['updated_at = NOW()'];
      const params: unknown[] = [];

      if (changes.displayName !== undefined) {
        params.push(changes.displayName);
        sets.push(`display_name = $${String(params.length)}`);
      }
      if (changes.preferences !== undefined) {
        params.push(JSON.stringify(changes.preferences));
        sets.push(`preferences = preferences || $${String(params.length)}::jsonb`);
      }

      params.push(userId);
      const { rows } = await this.pool.query<UserRow>(
        `UPDATE identity_users SET ${sets.join(', ')}
         WHERE id = $${String(params.length)}
         RETURNING *`,
        params,
      );

      const updatedRow = rows[0];
      if (!updatedRow) {
        return err(new IE('ACCOUNT_NOT_FOUND', `User ${userId} not found`));
      }
      return ok(await this.hydrateUser(updatedRow));
    } catch (e) {
      return err(mapDbError(e));
    }
  }

  async archive(userId: string): Promise<Result<void, IdentityError>> {
    try {
      await this.pool.query(
        `UPDATE identity_users
         SET status = 'archived', archived_at = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [userId],
      );
      return ok(undefined);
    } catch (e) {
      return err(mapDbError(e));
    }
  }

  async restore(userId: string): Promise<Result<User, IdentityError>> {
    try {
      const { rows } = await this.pool.query<UserRow>(
        `UPDATE identity_users
         SET status = 'active', archived_at = NULL, updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [userId],
      );
      const restoredRow = rows[0];
      if (!restoredRow) {
        return err(new IE('ACCOUNT_NOT_FOUND', `User ${userId} not found`));
      }
      return ok(await this.hydrateUser(restoredRow));
    } catch (e) {
      return err(mapDbError(e));
    }
  }

  async hardDelete(userId: string): Promise<Result<void, IdentityError>> {
    try {
      await this.pool.query('DELETE FROM identity_users WHERE id = $1', [userId]);
      return ok(undefined);
    } catch (e) {
      return err(mapDbError(e));
    }
  }

  async search(opts: SearchOptions): Promise<Result<PaginatedResult<User>, IdentityError>> {
    try {
      const conditions: string[] = [];
      const params: unknown[] = [];

      if (opts.status && opts.status !== 'all') {
        params.push(opts.status);
        conditions.push(`status = $${String(params.length)}`);
      }

      if (opts.query) {
        params.push(`%${opts.query.toLowerCase()}%`);
        const idx = String(params.length);
        conditions.push(`(LOWER(primary_email) LIKE $${idx} OR LOWER(display_name) LIKE $${idx})`);
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const limit = opts.limit ?? 50;
      const offset = opts.offset ?? 0;

      const countResult = await this.pool.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM identity_users ${where}`,
        params,
      );
      const total = parseInt(countResult.rows[0]?.count ?? '0', 10);

      params.push(limit);
      params.push(offset);
      const { rows } = await this.pool.query<UserRow>(
        `SELECT * FROM identity_users ${where}
         ORDER BY created_at ASC
         LIMIT $${String(params.length - 1)} OFFSET $${String(params.length)}`,
        params,
      );

      const items = await Promise.all(rows.map((r) => this.hydrateUser(r)));
      return ok({ items, total });
    } catch (e) {
      return err(mapDbError(e));
    }
  }

  // ── MFA / credentials ───────────────────────────────────────────────────────

  async setMfaSecret(
    userId: string,
    secret: EncryptedSecret,
  ): Promise<Result<void, IdentityError>> {
    try {
      await ensureCredentials(this.pool, userId);
      const enabled = secret.ciphertext !== '';
      await this.pool.query(
        `UPDATE identity_credentials
         SET mfa_ciphertext = $1, mfa_key_version = $2, updated_at = NOW()
         WHERE user_id = $3`,
        [secret.ciphertext || null, secret.keyVersion || null, userId],
      );
      await this.pool.query(
        'UPDATE identity_users SET mfa_enabled = $1, updated_at = NOW() WHERE id = $2',
        [enabled, userId],
      );
      return ok(undefined);
    } catch (e) {
      return err(mapDbError(e));
    }
  }

  async getMfaSecret(userId: string): Promise<Result<EncryptedSecret | null, IdentityError>> {
    try {
      const { rows } = await this.pool.query<
        Pick<CredentialRow, 'mfa_ciphertext' | 'mfa_key_version'>
      >('SELECT mfa_ciphertext, mfa_key_version FROM identity_credentials WHERE user_id = $1', [
        userId,
      ]);
      const mfaRow = rows[0];
      if (rows.length === 0 || !mfaRow?.mfa_ciphertext) return ok(null);
      return ok({
        ciphertext: mfaRow.mfa_ciphertext,
        keyVersion: mfaRow.mfa_key_version ?? 'v1',
      });
    } catch (e) {
      return err(mapDbError(e));
    }
  }

  async setRecoveryCodes(
    userId: string,
    hashedCodes: string[],
  ): Promise<Result<void, IdentityError>> {
    try {
      await ensureCredentials(this.pool, userId);
      await this.pool.query(
        `UPDATE identity_credentials
         SET recovery_codes = $1, updated_at = NOW()
         WHERE user_id = $2`,
        [hashedCodes, userId],
      );
      return ok(undefined);
    } catch (e) {
      return err(mapDbError(e));
    }
  }

  async consumeRecoveryCode(
    userId: string,
    plaintextCode: string,
  ): Promise<Result<boolean, IdentityError>> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const { rows } = await client.query<Pick<CredentialRow, 'recovery_codes'>>(
        'SELECT recovery_codes FROM identity_credentials WHERE user_id = $1 FOR UPDATE',
        [userId],
      );
      const codeRow = rows[0];
      if (!codeRow) {
        await client.query('ROLLBACK');
        return ok(false);
      }
      const codes: string[] = codeRow.recovery_codes;
      let matchIdx = -1;

      for (let i = 0; i < codes.length; i++) {
        const hash = codes[i];
        if (!hash) continue;
        try {
          const match = await argonVerify(hash, plaintextCode);
          if (match) {
            matchIdx = i;
            break;
          }
        } catch {
          // malformed hash — skip
        }
      }

      if (matchIdx === -1) {
        await client.query('ROLLBACK');
        return ok(false);
      }

      const remaining = [...codes.slice(0, matchIdx), ...codes.slice(matchIdx + 1)];
      await client.query(
        'UPDATE identity_credentials SET recovery_codes = $1, updated_at = NOW() WHERE user_id = $2',
        [remaining, userId],
      );

      await client.query('COMMIT');
      return ok(true);
    } catch (e) {
      await client.query('ROLLBACK');
      return err(mapDbError(e));
    } finally {
      client.release();
    }
  }

  async setPasswordHash(userId: string, hash: VersionedHash): Promise<Result<void, IdentityError>> {
    try {
      await ensureCredentials(this.pool, userId);
      await this.pool.query(
        `UPDATE identity_credentials
         SET password_hash = $1, password_version = $2, password_algorithm = $3, updated_at = NOW()
         WHERE user_id = $4`,
        [hash.hash, hash.version, hash.algorithm, userId],
      );
      return ok(undefined);
    } catch (e) {
      return err(mapDbError(e));
    }
  }

  async getPasswordHash(userId: string): Promise<Result<VersionedHash | null, IdentityError>> {
    try {
      const { rows } = await this.pool.query<
        Pick<CredentialRow, 'password_hash' | 'password_version' | 'password_algorithm'>
      >(
        'SELECT password_hash, password_version, password_algorithm FROM identity_credentials WHERE user_id = $1',
        [userId],
      );
      const pwRow = rows[0];
      if (rows.length === 0 || !pwRow?.password_hash) return ok(null);
      return ok({
        hash: pwRow.password_hash,
        version: pwRow.password_version ?? 1,
        algorithm: (pwRow.password_algorithm ?? 'argon2id') as 'argon2id',
      });
    } catch (e) {
      return err(mapDbError(e));
    }
  }

  // ── Lockout ─────────────────────────────────────────────────────────────────

  async recordFailedLogin(
    userId: string,
    _ipAddress: string,
  ): Promise<Result<void, IdentityError>> {
    try {
      await ensureCredentials(this.pool, userId);
      await this.pool.query(
        `UPDATE identity_credentials
         SET failed_login_count = failed_login_count + 1,
             last_failed_login_at = NOW(),
             lockout_until = CASE
               WHEN failed_login_count + 1 >= $1
               THEN NOW() + INTERVAL '${String(LOCKOUT_MINUTES)} minutes'
               ELSE lockout_until
             END,
             updated_at = NOW()
         WHERE user_id = $2`,
        [LOCKOUT_THRESHOLD, userId],
      );
      return ok(undefined);
    } catch (e) {
      return err(mapDbError(e));
    }
  }

  async resetFailedLogins(userId: string): Promise<Result<void, IdentityError>> {
    try {
      await this.pool.query(
        `UPDATE identity_credentials
         SET failed_login_count = 0,
             last_failed_login_at = NULL,
             lockout_until = NULL,
             updated_at = NOW()
         WHERE user_id = $1`,
        [userId],
      );
      return ok(undefined);
    } catch (e) {
      return err(mapDbError(e));
    }
  }

  async isLockedOut(
    userId: string,
  ): Promise<Result<{ locked: boolean; until?: Date }, IdentityError>> {
    try {
      const { rows } = await this.pool.query<Pick<CredentialRow, 'lockout_until'>>(
        'SELECT lockout_until FROM identity_credentials WHERE user_id = $1',
        [userId],
      );
      const lockRow = rows[0];
      if (!lockRow) return ok({ locked: false });
      const until = lockRow.lockout_until;
      if (!until || until <= new Date()) return ok({ locked: false });
      return ok({ locked: true, until });
    } catch (e) {
      return err(mapDbError(e));
    }
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private async hydrateUser(row: UserRow): Promise<User> {
    const { rows } = await this.pool.query<IdentityRow>(
      'SELECT * FROM identity_identities WHERE user_id = $1 ORDER BY is_primary DESC, linked_at ASC',
      [row.id],
    );
    return mapUserRow(row, rows);
  }

  private async hydrateUserWithClient(client: PoolClient, row: UserRow): Promise<User> {
    const { rows } = await client.query<IdentityRow>(
      'SELECT * FROM identity_identities WHERE user_id = $1 ORDER BY is_primary DESC, linked_at ASC',
      [row.id],
    );
    return mapUserRow(row, rows);
  }
}
