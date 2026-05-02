import { describe, expect, it } from 'vitest';

import type { SessionPort } from '../session.port.js';
import type { CreateSessionInput } from '../types.js';

const baseInput: CreateSessionInput = {
  userId: crypto.randomUUID(),
  identityProvider: 'builtin',
  ipAddress: '127.0.0.1',
  userAgent: 'test-agent/1.0',
};

export function runSessionConformance(name: string, factory: () => Promise<SessionPort>): void {
  describe(`${name} — SessionPort conformance`, () => {
    // ── create / findByToken ──────────────────────────────────────────────────

    it('create returns a plaintext token and a session with tokenHash', async () => {
      const sessions = await factory();
      const result = (await sessions.create(baseInput))._unsafeUnwrap();

      expect(result.token).toBeTruthy();
      expect(result.session.tokenHash).toBeTruthy();
      // The plaintext token must NOT equal its hash
      expect(result.token).not.toBe(result.session.tokenHash);
      expect(result.session.userId).toBe(baseInput.userId);
    });

    it('findByToken returns the session for a valid token', async () => {
      const sessions = await factory();
      const { session, token } = (await sessions.create(baseInput))._unsafeUnwrap();
      const found = (await sessions.findByToken(token))._unsafeUnwrap();
      expect(found?.id).toBe(session.id);
    });

    it('findByToken returns null for an unknown token', async () => {
      const sessions = await factory();
      const result = (await sessions.findByToken('unknown-token'))._unsafeUnwrap();
      expect(result).toBeNull();
    });

    // ── touch ─────────────────────────────────────────────────────────────────

    it('touch updates lastSeenAt', async () => {
      const sessions = await factory();
      const { session } = (await sessions.create(baseInput))._unsafeUnwrap();
      const before = session.lastSeenAt;
      // Small delay so timestamps differ
      await new Promise((resolve) => setTimeout(resolve, 10));
      const touched = (await sessions.touch(session.id))._unsafeUnwrap();
      expect(touched.lastSeenAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });

    // ── refresh ───────────────────────────────────────────────────────────────

    it('refresh issues a new token and invalidates the old one', async () => {
      const sessions = await factory();
      const { token: oldToken } = (await sessions.create(baseInput))._unsafeUnwrap();
      const { newToken } = (await sessions.refresh(oldToken))._unsafeUnwrap();

      expect(newToken).not.toBe(oldToken);

      // Old token must no longer work
      const oldLookup = (await sessions.findByToken(oldToken))._unsafeUnwrap();
      expect(oldLookup).toBeNull();

      // New token must work
      const newLookup = (await sessions.findByToken(newToken))._unsafeUnwrap();
      expect(newLookup).not.toBeNull();
    });

    // ── revoke ────────────────────────────────────────────────────────────────

    it('revoke prevents subsequent findByToken', async () => {
      const sessions = await factory();
      const { session, token } = (await sessions.create(baseInput))._unsafeUnwrap();
      await sessions.revoke(session.id);
      const result = (await sessions.findByToken(token))._unsafeUnwrap();
      expect(result).toBeNull();
    });

    // ── revokeAllForUser ──────────────────────────────────────────────────────

    it('revokeAllForUser invalidates all sessions for that user', async () => {
      const sessions = await factory();
      const userId = crypto.randomUUID();
      const input: CreateSessionInput = { ...baseInput, userId };

      const { token: t1 } = (await sessions.create(input))._unsafeUnwrap();
      const { token: t2 } = (await sessions.create(input))._unsafeUnwrap();

      await sessions.revokeAllForUser(userId);

      expect((await sessions.findByToken(t1))._unsafeUnwrap()).toBeNull();
      expect((await sessions.findByToken(t2))._unsafeUnwrap()).toBeNull();
    });

    it('revokeAllForUser does not affect sessions belonging to other users', async () => {
      const sessions = await factory();
      const userId1 = crypto.randomUUID();
      const userId2 = crypto.randomUUID();

      const { token: t1 } = (
        await sessions.create({ ...baseInput, userId: userId1 })
      )._unsafeUnwrap();
      const { token: t2 } = (
        await sessions.create({ ...baseInput, userId: userId2 })
      )._unsafeUnwrap();

      await sessions.revokeAllForUser(userId1);

      expect((await sessions.findByToken(t1))._unsafeUnwrap()).toBeNull();
      expect((await sessions.findByToken(t2))._unsafeUnwrap()).not.toBeNull();
    });

    // ── listForUser ───────────────────────────────────────────────────────────

    it('listForUser returns all active sessions', async () => {
      const sessions = await factory();
      const userId = crypto.randomUUID();
      const input: CreateSessionInput = { ...baseInput, userId };

      await sessions.create(input);
      await sessions.create(input);

      const list = (await sessions.listForUser(userId))._unsafeUnwrap();
      expect(list.length).toBe(2);
    });

    it('listForUser excludes revoked sessions', async () => {
      const sessions = await factory();
      const userId = crypto.randomUUID();
      const input: CreateSessionInput = { ...baseInput, userId };

      const { session: s1 } = (await sessions.create(input))._unsafeUnwrap();
      await sessions.create(input);

      await sessions.revoke(s1.id);

      const list = (await sessions.listForUser(userId))._unsafeUnwrap();
      expect(list.length).toBe(1);
    });

    // ── cleanupExpired ────────────────────────────────────────────────────────

    it('cleanupExpired returns a deleted count (may be zero)', async () => {
      const sessions = await factory();
      const result = (await sessions.cleanupExpired())._unsafeUnwrap();
      expect(typeof result.deleted).toBe('number');
    });
  });
}
