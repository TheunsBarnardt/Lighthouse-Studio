import { describe, expect, it } from 'vitest';

import type { SecretStorePort } from '../secret-store.port.js';

export function runSecretStoreConformance(
  name: string,
  factory: () => Promise<SecretStorePort>,
): void {
  describe(`${name} — SecretStorePort conformance`, () => {
    it('get returns SecretNotFoundError for a missing key', async () => {
      const store = await factory();
      const result = await store.get('nonexistent-secret-key');
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('SECRET_NOT_FOUND');
    });

    it('set then get round-trips the value', async () => {
      const store = await factory();
      const key = `test-secret-${String(Date.now())}`;
      await store.set(key, 'my-secret-value');
      const result = await store.get(key);
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toBe('my-secret-value');
    });

    it('delete removes the secret', async () => {
      const store = await factory();
      const key = `delete-secret-${String(Date.now())}`;
      await store.set(key, 'to-delete');
      await store.delete(key);
      const result = await store.get(key);
      expect(result.isErr()).toBe(true);
    });

    it('list returns previously set keys', async () => {
      const store = await factory();
      const key = `list-secret-${String(Date.now())}`;
      await store.set(key, 'list-value');
      const result = await store.list();
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toContain(key);
    });
  });
}
