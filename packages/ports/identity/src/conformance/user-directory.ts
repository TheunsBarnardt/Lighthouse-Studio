import { describe, expect, it } from 'vitest';

import type { CreateUserInput } from '../types.js';
import type { UserDirectoryPort } from '../user-directory.port.js';

const baseInput: CreateUserInput = {
  email: 'alice@example.com',
  displayName: 'Alice',
  identity: {
    providerId: 'builtin',
    subject: 'alice-subject-001',
    email: 'alice@example.com',
    emailVerified: false,
    primary: true,
  },
};

export function runUserDirectoryConformance(
  name: string,
  factory: () => Promise<UserDirectoryPort>,
): void {
  describe(`${name} — UserDirectoryPort conformance`, () => {
    // ── create / findById / findByEmail / findByIdentity ─────────────────────

    it('creates a user and finds them by id', async () => {
      const dir = await factory();
      const created = (await dir.create(baseInput))._unsafeUnwrap();
      expect(created.primaryEmail).toBe('alice@example.com');
      expect(created.displayName).toBe('Alice');
      expect(created.status).toBe('pending_verification');
      expect(created.identities).toHaveLength(1);

      const found = (await dir.findById(created.id))._unsafeUnwrap();
      expect(found?.id).toBe(created.id);
    });

    it('finds a user by email', async () => {
      const dir = await factory();
      const created = (await dir.create(baseInput))._unsafeUnwrap();
      const found = (await dir.findByEmail('alice@example.com'))._unsafeUnwrap();
      expect(found?.id).toBe(created.id);
    });

    it('finds a user by identity', async () => {
      const dir = await factory();
      const created = (await dir.create(baseInput))._unsafeUnwrap();
      const found = (await dir.findByIdentity('builtin', 'alice-subject-001'))._unsafeUnwrap();
      expect(found?.id).toBe(created.id);
    });

    it('returns null for unknown id', async () => {
      const dir = await factory();
      const result = await dir.findById(crypto.randomUUID());
      expect(result._unsafeUnwrap()).toBeNull();
    });

    it('returns null for unknown email', async () => {
      const dir = await factory();
      const result = await dir.findByEmail('nobody@example.com');
      expect(result._unsafeUnwrap()).toBeNull();
    });

    it('rejects duplicate email', async () => {
      const dir = await factory();
      await dir.create(baseInput);
      const second = await dir.create({
        ...baseInput,
        identity: { ...baseInput.identity, subject: 'other-subject' },
      });
      expect(second.isErr()).toBe(true);
      expect(second._unsafeUnwrapErr().code).toBe('CONFLICT');
    });

    it('rejects duplicate (providerId, subject) pair', async () => {
      const dir = await factory();
      await dir.create(baseInput);
      const second = await dir.create({
        ...baseInput,
        email: 'other@example.com',
      });
      expect(second.isErr()).toBe(true);
      expect(second._unsafeUnwrapErr().code).toBe('CONFLICT');
    });

    // ── linkIdentity / unlinkIdentity ─────────────────────────────────────────

    it('links a second identity and finds by either', async () => {
      const dir = await factory();
      const user = (await dir.create(baseInput))._unsafeUnwrap();

      await dir.linkIdentity(user.id, {
        providerId: 'entra',
        subject: 'entra-sub-001',
        email: 'alice@corp.example.com',
        emailVerified: true,
        primary: false,
        linkedAt: new Date(),
        lastUsedAt: null,
      });

      const byEntra = (await dir.findByIdentity('entra', 'entra-sub-001'))._unsafeUnwrap();
      expect(byEntra?.id).toBe(user.id);

      const updated = (await dir.findById(user.id))._unsafeUnwrap();
      expect(updated?.identities).toHaveLength(2);
    });

    it('cannot link an identity already attached to another user', async () => {
      const dir = await factory();
      const user1 = (await dir.create(baseInput))._unsafeUnwrap();
      const user2 = (
        await dir.create({
          email: 'bob@example.com',
          identity: { providerId: 'builtin', subject: 'bob-sub-001', emailVerified: false },
        })
      )._unsafeUnwrap();

      const result = await dir.linkIdentity(user2.id, {
        providerId: 'builtin',
        subject: 'alice-subject-001',
        email: 'alice@example.com',
        emailVerified: false,
        primary: false,
        linkedAt: new Date(),
        lastUsedAt: null,
      });
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('CONFLICT');

      // user1 is unaffected
      const check = (await dir.findById(user1.id))._unsafeUnwrap();
      expect(check?.identities).toHaveLength(1);
    });

    it('unlinks a secondary identity', async () => {
      const dir = await factory();
      const user = (await dir.create(baseInput))._unsafeUnwrap();
      await dir.linkIdentity(user.id, {
        providerId: 'entra',
        subject: 'entra-sub-001',
        email: null,
        emailVerified: false,
        primary: false,
        linkedAt: new Date(),
        lastUsedAt: null,
      });

      await dir.unlinkIdentity(user.id, 'entra');

      const updated = (await dir.findById(user.id))._unsafeUnwrap();
      expect(updated?.identities).toHaveLength(1);
    });

    it('cannot unlink the last identity', async () => {
      const dir = await factory();
      const user = (await dir.create(baseInput))._unsafeUnwrap();
      const result = await dir.unlinkIdentity(user.id, 'builtin');
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('INVALID_STATE');
    });

    // ── updateProfile ─────────────────────────────────────────────────────────

    it('updates display name', async () => {
      const dir = await factory();
      const user = (await dir.create(baseInput))._unsafeUnwrap();
      const updated = (
        await dir.updateProfile(user.id, { displayName: 'Alice Updated' })
      )._unsafeUnwrap();
      expect(updated.displayName).toBe('Alice Updated');
    });

    it('updateProfile on unknown user returns ACCOUNT_NOT_FOUND', async () => {
      const dir = await factory();
      const result = await dir.updateProfile(crypto.randomUUID(), { displayName: 'X' });
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('ACCOUNT_NOT_FOUND');
    });

    // ── archive / restore ────────────────────────────────────────────────────

    it('archives a user — archived user not found by identity', async () => {
      const dir = await factory();
      const user = (await dir.create(baseInput))._unsafeUnwrap();
      await dir.archive(user.id);

      const byIdentity = (await dir.findByIdentity('builtin', 'alice-subject-001'))._unsafeUnwrap();
      expect(byIdentity).toBeNull();
    });

    it('restores an archived user', async () => {
      const dir = await factory();
      const user = (await dir.create(baseInput))._unsafeUnwrap();
      await dir.archive(user.id);
      const restored = (await dir.restore(user.id))._unsafeUnwrap();
      expect(restored.status).toBe('active');

      const byIdentity = (await dir.findByIdentity('builtin', 'alice-subject-001'))._unsafeUnwrap();
      expect(byIdentity?.id).toBe(user.id);
    });

    // ── hardDelete ────────────────────────────────────────────────────────────

    it('hard-deletes a user — record gone', async () => {
      const dir = await factory();
      const user = (await dir.create(baseInput))._unsafeUnwrap();
      await dir.hardDelete(user.id);
      const found = (await dir.findById(user.id))._unsafeUnwrap();
      expect(found).toBeNull();
    });

    // ── search ────────────────────────────────────────────────────────────────

    it('search returns created users', async () => {
      const dir = await factory();
      await dir.create(baseInput);
      const result = (await dir.search({ limit: 10, status: 'all' }))._unsafeUnwrap();
      expect(result.total).toBeGreaterThanOrEqual(1);
    });

    // ── MFA secrets ──────────────────────────────────────────────────────────

    it('stores and retrieves an MFA secret', async () => {
      const dir = await factory();
      const user = (await dir.create(baseInput))._unsafeUnwrap();
      const secret = { ciphertext: 'enc-secret', keyVersion: 'v1' };
      await dir.setMfaSecret(user.id, secret);
      const retrieved = (await dir.getMfaSecret(user.id))._unsafeUnwrap();
      expect(retrieved).toEqual(secret);
    });

    it('getMfaSecret returns null before any secret is set', async () => {
      const dir = await factory();
      const user = (await dir.create(baseInput))._unsafeUnwrap();
      const result = (await dir.getMfaSecret(user.id))._unsafeUnwrap();
      expect(result).toBeNull();
    });

    it('recovery code consumption is single-use', async () => {
      const dir = await factory();
      const user = (await dir.create(baseInput))._unsafeUnwrap();
      // Store two hashed codes
      await dir.setRecoveryCodes(user.id, ['hash-a', 'hash-b']);
      const first = (await dir.consumeRecoveryCode(user.id, 'hash-a'))._unsafeUnwrap();
      expect(first).toBe(true);
      // Same code again must fail
      const second = (await dir.consumeRecoveryCode(user.id, 'hash-a'))._unsafeUnwrap();
      expect(second).toBe(false);
      // Other code still works
      const third = (await dir.consumeRecoveryCode(user.id, 'hash-b'))._unsafeUnwrap();
      expect(third).toBe(true);
    });

    // ── Password / lockout ───────────────────────────────────────────────────

    it('stores and retrieves a password hash', async () => {
      const dir = await factory();
      const user = (await dir.create(baseInput))._unsafeUnwrap();
      const hash = { hash: '$argon2id$...', version: 1, algorithm: 'argon2id' as const };
      await dir.setPasswordHash(user.id, hash);
      const retrieved = (await dir.getPasswordHash(user.id))._unsafeUnwrap();
      expect(retrieved).toEqual(hash);
    });

    it('getPasswordHash returns null before any hash is set', async () => {
      const dir = await factory();
      const user = (await dir.create(baseInput))._unsafeUnwrap();
      const result = (await dir.getPasswordHash(user.id))._unsafeUnwrap();
      expect(result).toBeNull();
    });

    it('failed login counter increments and triggers lockout at threshold', async () => {
      const dir = await factory();
      const user = (await dir.create(baseInput))._unsafeUnwrap();

      const ip = '1.2.3.4';
      for (let i = 0; i < 5; i++) {
        const before = (await dir.isLockedOut(user.id))._unsafeUnwrap();
        expect(before.locked).toBe(false);
        await dir.recordFailedLogin(user.id, ip);
      }

      const locked = (await dir.isLockedOut(user.id))._unsafeUnwrap();
      expect(locked.locked).toBe(true);
      expect(locked.until).toBeDefined();
    });

    it('resetFailedLogins clears the counter', async () => {
      const dir = await factory();
      const user = (await dir.create(baseInput))._unsafeUnwrap();
      for (let i = 0; i < 3; i++) {
        await dir.recordFailedLogin(user.id, '1.2.3.4');
      }
      await dir.resetFailedLogins(user.id);
      // 2 more attempts should not trigger lockout yet
      await dir.recordFailedLogin(user.id, '1.2.3.4');
      await dir.recordFailedLogin(user.id, '1.2.3.4');
      const status = (await dir.isLockedOut(user.id))._unsafeUnwrap();
      expect(status.locked).toBe(false);
    });
  });
}
