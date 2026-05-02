import type { CreateSessionInput, Session, SessionPort } from '@platform/ports-identity';
import type { IdentityError } from '@platform/ports-identity';
import type { Result } from 'neverthrow';

import { ok } from 'neverthrow';

const DEFAULT_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

function hashToken(token: string): string {
  // In tests we use a deterministic but not-cryptographic hash; real adapters
  // use HMAC-SHA256. The contract is: hash(token) is stable and unique.
  let h = 0;
  for (let i = 0; i < token.length; i++) {
    h = (Math.imul(31, h) + token.charCodeAt(i)) | 0;
  }
  return `hash:${String(h)}:${token.slice(0, 8)}`;
}

export class InMemorySessionAdapter implements SessionPort {
  private readonly sessions = new Map<string, Session>();
  private readonly tokenIndex = new Map<string, string>(); // tokenHash → sessionId

  create(
    input: CreateSessionInput,
  ): Promise<Result<{ session: Session; token: string }, IdentityError>> {
    const token = crypto.randomUUID();
    const tokenHash = hashToken(token);
    const now = new Date();
    const ttl = input.ttlSeconds ?? DEFAULT_TTL_SECONDS;
    const expiresAt = new Date(now.getTime() + ttl * 1000);

    const session: Session = {
      id: crypto.randomUUID(),
      userId: input.userId,
      tokenHash,
      identityProvider: input.identityProvider,
      workspaceId: input.workspaceId ?? null,
      createdAt: now,
      lastSeenAt: now,
      expiresAt,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      metadata: input.metadata ?? {},
    };

    this.sessions.set(session.id, session);
    this.tokenIndex.set(tokenHash, session.id);
    return Promise.resolve(ok({ session, token }));
  }

  findByToken(token: string): Promise<Result<Session | null, IdentityError>> {
    const hash = hashToken(token);
    const id = this.tokenIndex.get(hash);
    if (!id) return Promise.resolve(ok(null));
    const session = this.sessions.get(id);
    if (!session) return Promise.resolve(ok(null));
    if (session.expiresAt <= new Date()) return Promise.resolve(ok(null));
    return Promise.resolve(ok(session));
  }

  touch(sessionId: string): Promise<Result<Session, IdentityError>> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return Promise.resolve(ok({ ...({} as Session) }));
    }
    const now = new Date();
    const updated: Session = { ...session, lastSeenAt: now };
    this.sessions.set(sessionId, updated);
    return Promise.resolve(ok(updated));
  }

  refresh(token: string): Promise<Result<{ session: Session; newToken: string }, IdentityError>> {
    const hash = hashToken(token);
    const id = this.tokenIndex.get(hash);
    const session = id ? this.sessions.get(id) : undefined;

    if (!session || session.expiresAt <= new Date()) {
      return Promise.resolve(ok({ session: {} as Session, newToken: '' }));
    }

    // Revoke old token
    this.tokenIndex.delete(hash);

    // Issue new token
    const newToken = crypto.randomUUID();
    const newHash = hashToken(newToken);
    const now = new Date();
    const updated: Session = { ...session, tokenHash: newHash, lastSeenAt: now };
    this.sessions.set(session.id, updated);
    this.tokenIndex.set(newHash, session.id);

    return Promise.resolve(ok({ session: updated, newToken }));
  }

  revoke(sessionId: string): Promise<Result<void, IdentityError>> {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.tokenIndex.delete(session.tokenHash);
      this.sessions.delete(sessionId);
    }
    return Promise.resolve(ok(undefined));
  }

  revokeAllForUser(userId: string): Promise<Result<void, IdentityError>> {
    for (const [id, session] of this.sessions.entries()) {
      if (session.userId === userId) {
        this.tokenIndex.delete(session.tokenHash);
        this.sessions.delete(id);
      }
    }
    return Promise.resolve(ok(undefined));
  }

  listForUser(userId: string): Promise<Result<Session[], IdentityError>> {
    const now = new Date();
    const active: Session[] = [];
    for (const session of this.sessions.values()) {
      if (session.userId === userId && session.expiresAt > now) {
        active.push(session);
      }
    }
    return Promise.resolve(ok(active));
  }

  cleanupExpired(): Promise<Result<{ deleted: number }, IdentityError>> {
    const now = new Date();
    let deleted = 0;
    for (const [id, session] of this.sessions.entries()) {
      if (session.expiresAt <= now) {
        this.tokenIndex.delete(session.tokenHash);
        this.sessions.delete(id);
        deleted++;
      }
    }
    return Promise.resolve(ok({ deleted }));
  }
}
