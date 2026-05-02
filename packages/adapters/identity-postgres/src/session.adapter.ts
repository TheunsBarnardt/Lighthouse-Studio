import type {
  CreateSessionInput,
  IdentityError,
  Session,
  SessionPort,
} from '@platform/ports-identity';
import type { Result } from 'neverthrow';
import type { Pool } from 'pg';

import { IdentityError as IE } from '@platform/ports-identity';
import { err, ok } from 'neverthrow';
import { createHmac, randomBytes } from 'node:crypto';

// ── DB row type ───────────────────────────────────────────────────────────────

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
  metadata: Record<string, unknown>;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

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
    metadata: row.metadata,
  };
}

function mapDbError(e: unknown): IdentityError {
  return new IE('PROVIDER_ERROR', `Database error: ${String(e)}`, e);
}

// ── Adapter ───────────────────────────────────────────────────────────────────

/**
 * PostgreSQL implementation of SessionPort.
 *
 * Session tokens are never stored in plaintext. The caller receives the raw
 * token on `create` and `refresh`. All subsequent lookups use HMAC-SHA256
 * of the raw token against the stored hash.
 *
 * Token rotation on `refresh` is atomic: old hash is overwritten in a
 * single UPDATE, so there's no window where both tokens are valid.
 */
export class PostgresSessionAdapter implements SessionPort {
  constructor(
    private readonly pool: Pool,
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

      const { rows } = await this.pool.query<SessionRow>(
        `INSERT INTO identity_sessions
           (user_id, token_hash, identity_provider, workspace_id,
            expires_at, ip_address, user_agent, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          input.userId,
          tokenHash,
          input.identityProvider,
          input.workspaceId ?? null,
          expiresAt,
          input.ipAddress ?? null,
          input.userAgent ?? null,
          JSON.stringify(input.metadata ?? {}),
        ],
      );

      const row = rows[0];
      if (!row) return err(new IE('PROVIDER_ERROR', 'Session INSERT returned no row'));
      return ok({ session: mapRow(row), token });
    } catch (e) {
      return err(mapDbError(e));
    }
  }

  async findByToken(token: string): Promise<Result<Session | null, IdentityError>> {
    try {
      const tokenHash = hashToken(token, this.tokenSecret);
      const { rows } = await this.pool.query<SessionRow>(
        'SELECT * FROM identity_sessions WHERE token_hash = $1 AND expires_at > NOW()',
        [tokenHash],
      );
      const row = rows[0];
      return ok(row ? mapRow(row) : null);
    } catch (e) {
      return err(mapDbError(e));
    }
  }

  async touch(sessionId: string): Promise<Result<Session, IdentityError>> {
    try {
      const { rows } = await this.pool.query<SessionRow>(
        `UPDATE identity_sessions
         SET last_seen_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [sessionId],
      );
      const row = rows[0];
      if (!row) {
        return err(new IE('TOKEN_INVALID', `Session ${sessionId} not found`));
      }
      return ok(mapRow(row));
    } catch (e) {
      return err(mapDbError(e));
    }
  }

  async refresh(
    token: string,
  ): Promise<Result<{ session: Session; newToken: string }, IdentityError>> {
    try {
      const oldHash = hashToken(token, this.tokenSecret);
      const newToken = generateToken();
      const newHash = hashToken(newToken, this.tokenSecret);

      const { rows } = await this.pool.query<SessionRow>(
        `UPDATE identity_sessions
         SET token_hash = $1, last_seen_at = NOW()
         WHERE token_hash = $2 AND expires_at > NOW()
         RETURNING *`,
        [newHash, oldHash],
      );

      const row = rows[0];
      if (!row) {
        return err(new IE('TOKEN_INVALID', 'Session not found or expired'));
      }

      return ok({ session: mapRow(row), newToken });
    } catch (e) {
      return err(mapDbError(e));
    }
  }

  async revoke(sessionId: string): Promise<Result<void, IdentityError>> {
    try {
      await this.pool.query('DELETE FROM identity_sessions WHERE id = $1', [sessionId]);
      return ok(undefined);
    } catch (e) {
      return err(mapDbError(e));
    }
  }

  async revokeAllForUser(userId: string): Promise<Result<void, IdentityError>> {
    try {
      await this.pool.query('DELETE FROM identity_sessions WHERE user_id = $1', [userId]);
      return ok(undefined);
    } catch (e) {
      return err(mapDbError(e));
    }
  }

  async listForUser(userId: string): Promise<Result<Session[], IdentityError>> {
    try {
      const { rows } = await this.pool.query<SessionRow>(
        `SELECT * FROM identity_sessions
         WHERE user_id = $1 AND expires_at > NOW()
         ORDER BY last_seen_at DESC`,
        [userId],
      );
      return ok(rows.map(mapRow));
    } catch (e) {
      return err(mapDbError(e));
    }
  }

  async cleanupExpired(): Promise<Result<{ deleted: number }, IdentityError>> {
    try {
      const { rowCount } = await this.pool.query(
        'DELETE FROM identity_sessions WHERE expires_at <= NOW()',
      );
      return ok({ deleted: rowCount ?? 0 });
    } catch (e) {
      return err(mapDbError(e));
    }
  }
}
