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
  UserPreferences,
  VersionedHash,
} from '@platform/ports-identity';
import type { Result } from 'neverthrow';

import { IdentityError as IE } from '@platform/ports-identity';
import * as mssql from 'mssql';
import { err, ok } from 'neverthrow';
import { randomUUID } from 'node:crypto';

// ── Constants ──────────────────────────────────────────────────────────────────

const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_MINUTES = 15;

// ── Row types ──────────────────────────────────────────────────────────────────

interface UserRow {
  id: string;
  primary_email: string;
  email_verified: boolean;
  display_name: string | null;
  status: string;
  archived_at: Date | null;
  mfa_enabled: boolean;
  preferences: string;
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
  recovery_codes: string;
  failed_login_count: number;
  last_failed_login_at: Date | null;
  lockout_until: Date | null;
}

// ── Error mapping ──────────────────────────────────────────────────────────────

function mapMssqlError(e: unknown): IdentityError {
  const num = (e as { number?: number }).number;
  if (num === 2627 || num === 2601) {
    return new IE('CONFLICT', 'Unique constraint violation', e);
  }
  return new IE('PROVIDER_ERROR', `Database error: ${String(e)}`, e);
}

// ── Mappers ────────────────────────────────────────────────────────────────────

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
  const prefs = JSON.parse(row.preferences) as UserPreferences;
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

// ── Adapter ────────────────────────────────────────────────────────────────────

/**
 * MSSQL implementation of UserDirectoryPort.
 *
 * Recovery codes are stored as a JSON array in NVARCHAR(MAX).
 * Comparison is exact string equality — the MFA layer is responsible
 * for hashing before calling setRecoveryCodes / consumeRecoveryCode.
 */
export class MssqlUserDirectory implements UserDirectoryPort {
  constructor(private readonly pool: mssql.ConnectionPool) {}

  // ── Lookup ──────────────────────────────────────────────────────────────────

  async findById(id: string): Promise<Result<User | null, IdentityError>> {
    try {
      const req = this.pool.request();
      req.input('id', id);
      const res = await req.query<UserRow>('SELECT * FROM [dbo].[identity_users] WHERE [id] = @id');
      const row = res.recordset[0];
      if (!row) return ok(null);
      return ok(await this.hydrateUser(row));
    } catch (e) {
      return err(mapMssqlError(e));
    }
  }

  async findByEmail(email: string): Promise<Result<User | null, IdentityError>> {
    try {
      const req = this.pool.request();
      req.input('email', email.toLowerCase());
      const res = await req.query<UserRow>(
        `SELECT * FROM [dbo].[identity_users]
         WHERE LOWER([primary_email]) = @email AND [status] != 'archived'`,
      );
      const row = res.recordset[0];
      if (!row) return ok(null);
      return ok(await this.hydrateUser(row));
    } catch (e) {
      return err(mapMssqlError(e));
    }
  }

  async findByIdentity(
    providerId: string,
    subject: string,
  ): Promise<Result<User | null, IdentityError>> {
    try {
      const req = this.pool.request();
      req.input('providerId', providerId);
      req.input('subject', subject);
      const res = await req.query<{ user_id: string }>(
        `SELECT [user_id] FROM [dbo].[identity_identities]
         WHERE [provider_id] = @providerId AND [subject] = @subject`,
      );
      const row = res.recordset[0];
      if (!row) return ok(null);
      return await this.findById(row.user_id);
    } catch (e) {
      return err(mapMssqlError(e));
    }
  }

  // ── Mutation ────────────────────────────────────────────────────────────────

  async create(input: CreateUserInput): Promise<Result<User, IdentityError>> {
    const transaction = new mssql.Transaction(this.pool);
    try {
      await transaction.begin();

      const userId = randomUUID();

      const userReq = transaction.request();
      userReq.input('id', userId);
      userReq.input('email', input.email);
      userReq.input('emailVerified', (input.identity.emailVerified ?? false) ? 1 : 0);
      userReq.input('displayName', input.displayName ?? null);
      userReq.input('preferences', JSON.stringify(input.preferences ?? {}));
      await userReq.query(`
        INSERT INTO [dbo].[identity_users]
          ([id], [primary_email], [email_verified], [display_name], [preferences])
        VALUES (@id, @email, @emailVerified, @displayName, @preferences)
      `);

      const identityReq = transaction.request();
      identityReq.input('id', randomUUID());
      identityReq.input('userId', userId);
      identityReq.input('providerId', input.identity.providerId);
      identityReq.input('subject', input.identity.subject);
      identityReq.input('identityEmail', input.identity.email ?? input.email);
      identityReq.input('identityEmailVerified', (input.identity.emailVerified ?? false) ? 1 : 0);
      identityReq.input('isPrimary', (input.identity.primary ?? true) ? 1 : 0);
      await identityReq.query(`
        INSERT INTO [dbo].[identity_identities]
          ([id], [user_id], [provider_id], [subject], [email], [email_verified], [is_primary])
        VALUES
          (@id, @userId, @providerId, @subject, @identityEmail, @identityEmailVerified, @isPrimary)
      `);

      const credReq = transaction.request();
      credReq.input('userId', userId);
      await credReq.query('INSERT INTO [dbo].[identity_credentials] ([user_id]) VALUES (@userId)');

      await transaction.commit();

      const user = await this.fetchUser(userId);
      if (!user) return err(new IE('PROVIDER_ERROR', 'User created but could not be retrieved'));
      return ok(user);
    } catch (e) {
      try {
        await transaction.rollback();
      } catch {
        // ignore
      }
      return err(mapMssqlError(e));
    }
  }

  async linkIdentity(userId: string, identity: Identity): Promise<Result<void, IdentityError>> {
    try {
      const req = this.pool.request();
      req.input('id', randomUUID());
      req.input('userId', userId);
      req.input('providerId', identity.providerId);
      req.input('subject', identity.subject);
      req.input('email', identity.email);
      req.input('emailVerified', identity.emailVerified ? 1 : 0);
      req.input('isPrimary', identity.primary ? 1 : 0);
      req.input('linkedAt', identity.linkedAt);
      req.input('lastUsedAt', identity.lastUsedAt ?? null);
      await req.query(`
        MERGE [dbo].[identity_identities] AS target
        USING (VALUES (@id, @userId, @providerId, @subject, @email, @emailVerified,
                       @isPrimary, @linkedAt, @lastUsedAt))
          AS source (id, user_id, provider_id, subject, email, email_verified,
                     is_primary, linked_at, last_used_at)
        ON target.[provider_id] = source.[provider_id]
           AND target.[subject] = source.[subject]
        WHEN MATCHED THEN
          UPDATE SET [email] = source.[email],
                     [email_verified] = source.[email_verified],
                     [last_used_at] = source.[last_used_at]
        WHEN NOT MATCHED THEN
          INSERT ([id], [user_id], [provider_id], [subject], [email],
                  [email_verified], [is_primary], [linked_at], [last_used_at])
          VALUES (source.[id], source.[user_id], source.[provider_id], source.[subject],
                  source.[email], source.[email_verified], source.[is_primary],
                  source.[linked_at], source.[last_used_at]);
      `);
      return ok(undefined);
    } catch (e) {
      return err(mapMssqlError(e));
    }
  }

  async unlinkIdentity(userId: string, providerId: string): Promise<Result<void, IdentityError>> {
    try {
      const countReq = this.pool.request();
      countReq.input('userId', userId);
      const countRes = await countReq.query<{ cnt: number }>(
        'SELECT COUNT(1) AS cnt FROM [dbo].[identity_identities] WHERE [user_id] = @userId',
      );
      const cnt = countRes.recordset[0]?.cnt ?? 0;
      if (cnt <= 1) {
        return err(new IE('INVALID_STATE', 'Cannot unlink the last identity from a user'));
      }

      const req = this.pool.request();
      req.input('userId', userId);
      req.input('providerId', providerId);
      await req.query(
        'DELETE FROM [dbo].[identity_identities] WHERE [user_id] = @userId AND [provider_id] = @providerId',
      );
      return ok(undefined);
    } catch (e) {
      return err(mapMssqlError(e));
    }
  }

  async updateProfile(
    userId: string,
    changes: ProfileUpdate,
  ): Promise<Result<User, IdentityError>> {
    try {
      const sets: string[] = ['[updated_at] = SYSUTCDATETIME()'];
      const req = this.pool.request();
      req.input('userId', userId);

      if (changes.displayName !== undefined) {
        req.input('displayName', changes.displayName);
        sets.push('[display_name] = @displayName');
      }
      if (changes.preferences !== undefined) {
        req.input('prefs', JSON.stringify(changes.preferences));
        sets.push(
          `[preferences] = JSON_MODIFY(ISNULL([preferences], '{}'), '$', JSON_QUERY(@prefs))`,
        );
      }

      await req.query(`UPDATE [dbo].[identity_users] SET ${sets.join(', ')} WHERE [id] = @userId`);

      const user = await this.fetchUser(userId);
      if (!user) return err(new IE('ACCOUNT_NOT_FOUND', `User ${userId} not found`));
      return ok(user);
    } catch (e) {
      return err(mapMssqlError(e));
    }
  }

  async archive(userId: string): Promise<Result<void, IdentityError>> {
    try {
      const req = this.pool.request();
      req.input('userId', userId);
      await req.query(`
        UPDATE [dbo].[identity_users]
        SET [status] = 'archived', [archived_at] = SYSUTCDATETIME(), [updated_at] = SYSUTCDATETIME()
        WHERE [id] = @userId
      `);
      return ok(undefined);
    } catch (e) {
      return err(mapMssqlError(e));
    }
  }

  async restore(userId: string): Promise<Result<User, IdentityError>> {
    try {
      const req = this.pool.request();
      req.input('userId', userId);
      await req.query(`
        UPDATE [dbo].[identity_users]
        SET [status] = 'active', [archived_at] = NULL, [updated_at] = SYSUTCDATETIME()
        WHERE [id] = @userId
      `);
      const user = await this.fetchUser(userId);
      if (!user) return err(new IE('ACCOUNT_NOT_FOUND', `User ${userId} not found`));
      return ok(user);
    } catch (e) {
      return err(mapMssqlError(e));
    }
  }

  async hardDelete(userId: string): Promise<Result<void, IdentityError>> {
    try {
      const req = this.pool.request();
      req.input('userId', userId);
      await req.query('DELETE FROM [dbo].[identity_users] WHERE [id] = @userId');
      return ok(undefined);
    } catch (e) {
      return err(mapMssqlError(e));
    }
  }

  async search(opts: SearchOptions): Promise<Result<PaginatedResult<User>, IdentityError>> {
    try {
      const conditions: string[] = [];
      const req = this.pool.request();
      const countReq = this.pool.request();

      if (opts.status && opts.status !== 'all') {
        req.input('statusVal', opts.status);
        countReq.input('statusVal', opts.status);
        conditions.push(`[status] = @statusVal`);
      }
      if (opts.query) {
        req.input('queryVal', `%${opts.query.toLowerCase()}%`);
        countReq.input('queryVal', `%${opts.query.toLowerCase()}%`);
        conditions.push(
          `(LOWER([primary_email]) LIKE @queryVal OR LOWER([display_name]) LIKE @queryVal)`,
        );
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      req.input('limitVal', opts.limit ?? 50);
      req.input('offsetVal', opts.offset ?? 0);

      const countRes = await countReq.query<{ total: number }>(
        `SELECT COUNT(1) AS total FROM [dbo].[identity_users] ${where}`,
      );
      const total = countRes.recordset[0]?.total ?? 0;

      const dataRes = await req.query<UserRow>(
        `SELECT * FROM [dbo].[identity_users] ${where}
         ORDER BY [created_at] ASC
         OFFSET @offsetVal ROWS FETCH NEXT @limitVal ROWS ONLY`,
      );

      const items = await Promise.all(dataRes.recordset.map((r) => this.hydrateUser(r)));
      return ok({ items, total });
    } catch (e) {
      return err(mapMssqlError(e));
    }
  }

  // ── MFA / credentials ───────────────────────────────────────────────────────

  async setMfaSecret(
    userId: string,
    secret: EncryptedSecret,
  ): Promise<Result<void, IdentityError>> {
    try {
      await this.ensureCredentials(userId);
      const req = this.pool.request();
      req.input('userId', userId);
      req.input('mfaCiphertext', secret.ciphertext || null);
      req.input('mfaKeyVersion', secret.keyVersion || null);
      await req.query(`
        UPDATE [dbo].[identity_credentials]
        SET [mfa_ciphertext] = @mfaCiphertext, [mfa_key_version] = @mfaKeyVersion,
            [updated_at] = SYSUTCDATETIME()
        WHERE [user_id] = @userId
      `);
      const enabled = secret.ciphertext !== '';
      const userReq = this.pool.request();
      userReq.input('userId', userId);
      userReq.input('mfaEnabled', enabled ? 1 : 0);
      await userReq.query(
        'UPDATE [dbo].[identity_users] SET [mfa_enabled] = @mfaEnabled, [updated_at] = SYSUTCDATETIME() WHERE [id] = @userId',
      );
      return ok(undefined);
    } catch (e) {
      return err(mapMssqlError(e));
    }
  }

  async getMfaSecret(userId: string): Promise<Result<EncryptedSecret | null, IdentityError>> {
    try {
      const req = this.pool.request();
      req.input('userId', userId);
      const res = await req.query<Pick<CredentialRow, 'mfa_ciphertext' | 'mfa_key_version'>>(
        'SELECT [mfa_ciphertext], [mfa_key_version] FROM [dbo].[identity_credentials] WHERE [user_id] = @userId',
      );
      const row = res.recordset[0];
      if (!row?.mfa_ciphertext) return ok(null);
      return ok({ ciphertext: row.mfa_ciphertext, keyVersion: row.mfa_key_version ?? 'v1' });
    } catch (e) {
      return err(mapMssqlError(e));
    }
  }

  async setRecoveryCodes(
    userId: string,
    hashedCodes: string[],
  ): Promise<Result<void, IdentityError>> {
    try {
      await this.ensureCredentials(userId);
      const req = this.pool.request();
      req.input('userId', userId);
      req.input('codes', JSON.stringify(hashedCodes));
      await req.query(`
        UPDATE [dbo].[identity_credentials]
        SET [recovery_codes] = @codes, [updated_at] = SYSUTCDATETIME()
        WHERE [user_id] = @userId
      `);
      return ok(undefined);
    } catch (e) {
      return err(mapMssqlError(e));
    }
  }

  async consumeRecoveryCode(userId: string, code: string): Promise<Result<boolean, IdentityError>> {
    const transaction = new mssql.Transaction(this.pool);
    try {
      await transaction.begin();

      const selectReq = transaction.request();
      selectReq.input('userId', userId);
      const res = await selectReq.query<Pick<CredentialRow, 'recovery_codes'>>(
        'SELECT [recovery_codes] FROM [dbo].[identity_credentials] WHERE [user_id] = @userId',
      );
      const row = res.recordset[0];
      if (!row) {
        await transaction.rollback();
        return ok(false);
      }

      const codes: string[] = JSON.parse(row.recovery_codes) as string[];
      const idx = codes.indexOf(code);
      if (idx === -1) {
        await transaction.rollback();
        return ok(false);
      }

      const remaining = [...codes.slice(0, idx), ...codes.slice(idx + 1)];
      const updateReq = transaction.request();
      updateReq.input('userId', userId);
      updateReq.input('codes', JSON.stringify(remaining));
      await updateReq.query(
        'UPDATE [dbo].[identity_credentials] SET [recovery_codes] = @codes, [updated_at] = SYSUTCDATETIME() WHERE [user_id] = @userId',
      );

      await transaction.commit();
      return ok(true);
    } catch (e) {
      try {
        await transaction.rollback();
      } catch {
        // ignore
      }
      return err(mapMssqlError(e));
    }
  }

  async setPasswordHash(userId: string, hash: VersionedHash): Promise<Result<void, IdentityError>> {
    try {
      await this.ensureCredentials(userId);
      const req = this.pool.request();
      req.input('userId', userId);
      req.input('hash', hash.hash);
      req.input('version', hash.version);
      req.input('algorithm', hash.algorithm);
      await req.query(`
        UPDATE [dbo].[identity_credentials]
        SET [password_hash] = @hash, [password_version] = @version,
            [password_algorithm] = @algorithm, [updated_at] = SYSUTCDATETIME()
        WHERE [user_id] = @userId
      `);
      return ok(undefined);
    } catch (e) {
      return err(mapMssqlError(e));
    }
  }

  async getPasswordHash(userId: string): Promise<Result<VersionedHash | null, IdentityError>> {
    try {
      const req = this.pool.request();
      req.input('userId', userId);
      const res = await req.query<
        Pick<CredentialRow, 'password_hash' | 'password_version' | 'password_algorithm'>
      >(
        'SELECT [password_hash], [password_version], [password_algorithm] FROM [dbo].[identity_credentials] WHERE [user_id] = @userId',
      );
      const row = res.recordset[0];
      if (!row?.password_hash) return ok(null);
      return ok({
        hash: row.password_hash,
        version: row.password_version ?? 1,
        algorithm: (row.password_algorithm ?? 'argon2id') as 'argon2id',
      });
    } catch (e) {
      return err(mapMssqlError(e));
    }
  }

  // ── Lockout ─────────────────────────────────────────────────────────────────

  async recordFailedLogin(
    userId: string,
    _ipAddress: string,
  ): Promise<Result<void, IdentityError>> {
    try {
      await this.ensureCredentials(userId);
      const req = this.pool.request();
      req.input('userId', userId);
      req.input('threshold', LOCKOUT_THRESHOLD);
      req.input('lockoutMinutes', LOCKOUT_MINUTES);
      await req.query(`
        UPDATE [dbo].[identity_credentials]
        SET [failed_login_count] = [failed_login_count] + 1,
            [last_failed_login_at] = SYSUTCDATETIME(),
            [lockout_until] = CASE
              WHEN [failed_login_count] + 1 >= @threshold
              THEN DATEADD(MINUTE, @lockoutMinutes, SYSUTCDATETIME())
              ELSE [lockout_until]
            END,
            [updated_at] = SYSUTCDATETIME()
        WHERE [user_id] = @userId
      `);
      return ok(undefined);
    } catch (e) {
      return err(mapMssqlError(e));
    }
  }

  async resetFailedLogins(userId: string): Promise<Result<void, IdentityError>> {
    try {
      const req = this.pool.request();
      req.input('userId', userId);
      await req.query(`
        UPDATE [dbo].[identity_credentials]
        SET [failed_login_count] = 0, [last_failed_login_at] = NULL,
            [lockout_until] = NULL, [updated_at] = SYSUTCDATETIME()
        WHERE [user_id] = @userId
      `);
      return ok(undefined);
    } catch (e) {
      return err(mapMssqlError(e));
    }
  }

  async isLockedOut(
    userId: string,
  ): Promise<Result<{ locked: boolean; until?: Date }, IdentityError>> {
    try {
      const req = this.pool.request();
      req.input('userId', userId);
      const res = await req.query<Pick<CredentialRow, 'lockout_until'>>(
        'SELECT [lockout_until] FROM [dbo].[identity_credentials] WHERE [user_id] = @userId',
      );
      const row = res.recordset[0];
      if (!row) return ok({ locked: false });
      const until = row.lockout_until;
      if (!until || until <= new Date()) return ok({ locked: false });
      return ok({ locked: true, until });
    } catch (e) {
      return err(mapMssqlError(e));
    }
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private async hydrateUser(row: UserRow): Promise<User> {
    const req = this.pool.request();
    req.input('userId', row.id);
    const res = await req.query<IdentityRow>(
      'SELECT * FROM [dbo].[identity_identities] WHERE [user_id] = @userId ORDER BY [is_primary] DESC, [linked_at] ASC',
    );
    return mapUserRow(row, res.recordset);
  }

  private async fetchUser(userId: string): Promise<User | null> {
    const req = this.pool.request();
    req.input('id', userId);
    const res = await req.query<UserRow>('SELECT * FROM [dbo].[identity_users] WHERE [id] = @id');
    const row = res.recordset[0];
    if (!row) return null;
    return this.hydrateUser(row);
  }

  private async ensureCredentials(userId: string): Promise<void> {
    const req = this.pool.request();
    req.input('userId', userId);
    await req.query(`
      IF NOT EXISTS (SELECT 1 FROM [dbo].[identity_credentials] WHERE [user_id] = @userId)
        INSERT INTO [dbo].[identity_credentials] ([user_id]) VALUES (@userId)
    `);
  }
}
