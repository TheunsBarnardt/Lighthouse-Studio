import type {
  CreateSessionInput,
  IdentityError,
  Session,
  SessionPort,
} from '@platform/ports-identity';
import type { Collection, Db } from 'mongodb';
import type { Result } from 'neverthrow';

import { IdentityError as IE } from '@platform/ports-identity';
import { err, ok } from 'neverthrow';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';

// ── Constants ──────────────────────────────────────────────────────────────────

const DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60;

// ── Document shape (internal) ─────────────────────────────────────────────────

interface SessionDoc {
  _id: string;
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

function hashToken(token: string, secret: string): string {
  return createHmac('sha256', secret).update(token).digest('hex');
}

function mapDoc(doc: SessionDoc): Session {
  return {
    id: doc._id,
    userId: doc.user_id,
    tokenHash: doc.token_hash,
    identityProvider: doc.identity_provider,
    workspaceId: doc.workspace_id,
    createdAt: doc.created_at,
    lastSeenAt: doc.last_seen_at,
    expiresAt: doc.expires_at,
    ipAddress: doc.ip_address,
    userAgent: doc.user_agent,
    metadata: doc.metadata,
  };
}

function mapDbError(e: unknown): IdentityError {
  return new IE('PROVIDER_ERROR', `Database error: ${String(e)}`, e);
}

// ── Adapter ────────────────────────────────────────────────────────────────────

/**
 * MongoDB implementation of SessionPort.
 *
 * The `expires_at` field has a TTL index (expireAfterSeconds: 0), so MongoDB
 * automatically removes expired sessions. `findByToken` still checks expires_at
 * explicitly for sessions not yet cleaned up by the background task.
 *
 * Token rotation on `refresh` uses findOneAndUpdate with the old hash as filter,
 * making the rotation atomic — no window where both old and new tokens are valid.
 */
export class MongoSessionAdapter implements SessionPort {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly sessions: Collection<any>;

  constructor(
    db: Db,
    private readonly tokenSecret: string,
  ) {
    this.sessions = db.collection('identity_sessions');
  }

  async create(
    input: CreateSessionInput,
  ): Promise<Result<{ session: Session; token: string }, IdentityError>> {
    try {
      const token = generateToken();
      const tokenHash = hashToken(token, this.tokenSecret);
      const ttl = input.ttlSeconds ?? DEFAULT_TTL_SECONDS;
      const now = new Date();
      const expiresAt = new Date(now.getTime() + ttl * 1_000);

      const doc: SessionDoc = {
        _id: randomUUID(),
        user_id: input.userId,
        token_hash: tokenHash,
        identity_provider: input.identityProvider,
        workspace_id: input.workspaceId ?? null,
        created_at: now,
        last_seen_at: now,
        expires_at: expiresAt,
        ip_address: input.ipAddress ?? null,
        user_agent: input.userAgent ?? null,
        metadata: input.metadata ?? {},
      };

      await this.sessions.insertOne(doc);
      return ok({ session: mapDoc(doc), token });
    } catch (e) {
      return err(mapDbError(e));
    }
  }

  async findByToken(token: string): Promise<Result<Session | null, IdentityError>> {
    try {
      const tokenHash = hashToken(token, this.tokenSecret);
      const doc = (await this.sessions.findOne({
        token_hash: tokenHash,
        expires_at: { $gt: new Date() },
      })) as SessionDoc | null;
      return ok(doc ? mapDoc(doc) : null);
    } catch (e) {
      return err(mapDbError(e));
    }
  }

  async touch(sessionId: string): Promise<Result<Session, IdentityError>> {
    try {
      const doc = (await this.sessions.findOneAndUpdate(
        { _id: sessionId },
        { $set: { last_seen_at: new Date() } },
        { returnDocument: 'after' },
      )) as SessionDoc | null;
      if (!doc) return err(new IE('TOKEN_INVALID', `Session ${sessionId} not found`));
      return ok(mapDoc(doc));
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

      const doc = (await this.sessions.findOneAndUpdate(
        { token_hash: oldHash, expires_at: { $gt: new Date() } },
        { $set: { token_hash: newHash, last_seen_at: new Date() } },
        { returnDocument: 'after' },
      )) as SessionDoc | null;

      if (!doc) return err(new IE('TOKEN_INVALID', 'Session not found or expired'));
      return ok({ session: mapDoc(doc), newToken });
    } catch (e) {
      return err(mapDbError(e));
    }
  }

  async revoke(sessionId: string): Promise<Result<void, IdentityError>> {
    try {
      await this.sessions.deleteOne({ _id: sessionId });
      return ok(undefined);
    } catch (e) {
      return err(mapDbError(e));
    }
  }

  async revokeAllForUser(userId: string): Promise<Result<void, IdentityError>> {
    try {
      await this.sessions.deleteMany({ user_id: userId });
      return ok(undefined);
    } catch (e) {
      return err(mapDbError(e));
    }
  }

  async listForUser(userId: string): Promise<Result<Session[], IdentityError>> {
    try {
      const docs = (await this.sessions
        .find({ user_id: userId, expires_at: { $gt: new Date() } })
        .sort({ last_seen_at: -1 })
        .toArray()) as SessionDoc[];
      return ok(docs.map(mapDoc));
    } catch (e) {
      return err(mapDbError(e));
    }
  }

  async cleanupExpired(): Promise<Result<{ deleted: number }, IdentityError>> {
    try {
      const result = await this.sessions.deleteMany({ expires_at: { $lte: new Date() } });
      return ok({ deleted: result.deletedCount });
    } catch (e) {
      return err(mapDbError(e));
    }
  }
}
