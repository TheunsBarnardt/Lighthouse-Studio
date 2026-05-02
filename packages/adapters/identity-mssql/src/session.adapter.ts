import type {
  CreateSessionInput,
  IdentityError,
  Session,
  SessionPort,
} from '@platform/ports-identity';
import type * as mssql from 'mssql';
import type { Result } from 'neverthrow';

import { IdentityError as IE } from '@platform/ports-identity';
import { err, ok } from 'neverthrow';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';

// ── Constants ──────────────────────────────────────────────────────────────────

const DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60;

// ── Row type ──────────────────────────────────────────────────────────────────

interface SessionRow {
  id: string;
  user_id: string;
  token_hash: string;
  identity_provider: string;
  workspace_id: string | null;
  created_at: Date;
  last_seen_at: Date;
  expires_at: Date;
  ip_address: string | null;
  user_agent: string | null;
  metadata: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

function hashToken(token: string, secret: string): string {
  return createHmac('sha256', secret).update(token).digest('hex');
}

function mapRow(row: SessionRow): Session {
  return {
    id: row.id,
    userId: row.user_id,
    tokenHash: row.token_hash,
    identityProvider: row.identity_provider,
    workspaceId: row.workspace_id,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
    expiresAt: row.expires_at,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    metadata: JSON.parse(row.metadata) as Record<string, unknown>,
  };
}

function mapDbError(e: unknown): IdentityError {
  return new IE('PROVIDER_ERROR', `Database error: ${String(e)}`, e);
}

// ── Adapter ────────────────────────────────────────────────────────────────────

/**
 * MSSQL implementation of SessionPort.
 *
 * Token rotation on `refresh` is performed inside a transaction — the old
 * token_hash is replaced atomically, so there is no window where both tokens
 * are simultaneously valid.
 */
export class MssqlSessionAdapter implements SessionPort {
  constructor(
    private readonly pool: mssql.ConnectionPool,
    private readonly tokenSecret: string,
  ) {}

  async create(
    input: CreateSessionInput,
  ): Promise<Result<{ session: Session; token: string }, IdentityError>> {
    try {
      const token = generateToken();
      const tokenHash = hashToken(token, this.tokenSecret);
      const ttl = input.ttlSeconds ?? DEFAULT_TTL_SECONDS;
      const expiresAt = new Date(Date.now() + ttl * 1_000);
      const id = randomUUID();

      const req = this.pool.request();
      req.input('id', id);
      req.input('userId', input.userId);
      req.input('tokenHash', tokenHash);
      req.input('identityProvider', input.identityProvider);
      req.input('workspaceId', input.workspaceId ?? null);
      req.input('expiresAt', expiresAt);
      req.input('ipAddress', input.ipAddress ?? null);
      req.input('userAgent', input.userAgent ?? null);
      req.input('metadata', JSON.stringify(input.metadata ?? {}));

      await req.query(`
        INSERT INTO [dbo].[identity_sessions]
          ([id], [user_id], [token_hash], [identity_provider], [workspace_id],
           [expires_at], [ip_address], [user_agent], [metadata])
        VALUES
          (@id, @userId, @tokenHash, @identityProvider, @workspaceId,
           @expiresAt, @ipAddress, @userAgent, @metadata)
      `);

      const found = await this.findByToken(token);
      if (found.isErr()) return err(found.error);
      if (!found.value) return err(new IE('PROVIDER_ERROR', 'Session INSERT returned no row'));
      return ok({ session: found.value, token });
    } catch (e) {
      return err(mapDbError(e));
    }
  }

  async findByToken(token: string): Promise<Result<Session | null, IdentityError>> {
    try {
      const tokenHash = hashToken(token, this.tokenSecret);
      const req = this.pool.request();
      req.input('tokenHash', tokenHash);
      const res = await req.query<SessionRow>(
        `SELECT * FROM [dbo].[identity_sessions]
         WHERE [token_hash] = @tokenHash AND [expires_at] > SYSUTCDATETIME()`,
      );
      const row = res.recordset[0];
      return ok(row ? mapRow(row) : null);
    } catch (e) {
      return err(mapDbError(e));
    }
  }

  async touch(sessionId: string): Promise<Result<Session, IdentityError>> {
    try {
      const req = this.pool.request();
      req.input('id', sessionId);
      await req.query(
        'UPDATE [dbo].[identity_sessions] SET [last_seen_at] = SYSUTCDATETIME() WHERE [id] = @id',
      );

      const getReq = this.pool.request();
      getReq.input('id', sessionId);
      const res = await getReq.query<SessionRow>(
        'SELECT * FROM [dbo].[identity_sessions] WHERE [id] = @id',
      );
      const row = res.recordset[0];
      if (!row) return err(new IE('TOKEN_INVALID', `Session ${sessionId} not found`));
      return ok(mapRow(row));
    } catch (e) {
      return err(mapDbError(e));
    }
  }

  async refresh(
    token: string,
  ): Promise<Result<{ session: Session; newToken: string }, IdentityError>> {
    const { Transaction } = await import('mssql');
    const transaction = new Transaction(this.pool);
    try {
      await transaction.begin();

      const oldHash = hashToken(token, this.tokenSecret);
      const newToken = generateToken();
      const newHash = hashToken(newToken, this.tokenSecret);

      const req = transaction.request();
      req.input('oldHash', oldHash);
      req.input('newHash', newHash);
      await req.query(`
        UPDATE [dbo].[identity_sessions]
        SET [token_hash] = @newHash, [last_seen_at] = SYSUTCDATETIME()
        WHERE [token_hash] = @oldHash AND [expires_at] > SYSUTCDATETIME()
      `);

      const getReq = transaction.request();
      getReq.input('newHash', newHash);
      const res = await getReq.query<SessionRow>(
        'SELECT * FROM [dbo].[identity_sessions] WHERE [token_hash] = @newHash',
      );
      const row = res.recordset[0];

      await transaction.commit();

      if (!row) return err(new IE('TOKEN_INVALID', 'Session not found or expired'));
      return ok({ session: mapRow(row), newToken });
    } catch (e) {
      try {
        await transaction.rollback();
      } catch {
        // ignore
      }
      return err(mapDbError(e));
    }
  }

  async revoke(sessionId: string): Promise<Result<void, IdentityError>> {
    try {
      const req = this.pool.request();
      req.input('id', sessionId);
      await req.query('DELETE FROM [dbo].[identity_sessions] WHERE [id] = @id');
      return ok(undefined);
    } catch (e) {
      return err(mapDbError(e));
    }
  }

  async revokeAllForUser(userId: string): Promise<Result<void, IdentityError>> {
    try {
      const req = this.pool.request();
      req.input('userId', userId);
      await req.query('DELETE FROM [dbo].[identity_sessions] WHERE [user_id] = @userId');
      return ok(undefined);
    } catch (e) {
      return err(mapDbError(e));
    }
  }

  async listForUser(userId: string): Promise<Result<Session[], IdentityError>> {
    try {
      const req = this.pool.request();
      req.input('userId', userId);
      const res = await req.query<SessionRow>(
        `SELECT * FROM [dbo].[identity_sessions]
         WHERE [user_id] = @userId AND [expires_at] > SYSUTCDATETIME()
         ORDER BY [last_seen_at] DESC`,
      );
      return ok(res.recordset.map(mapRow));
    } catch (e) {
      return err(mapDbError(e));
    }
  }

  async cleanupExpired(): Promise<Result<{ deleted: number }, IdentityError>> {
    try {
      const res = await this.pool
        .request()
        .query('DELETE FROM [dbo].[identity_sessions] WHERE [expires_at] <= SYSUTCDATETIME()');
      return ok({ deleted: res.rowsAffected[0] ?? 0 });
    } catch (e) {
      return err(mapDbError(e));
    }
  }
}
