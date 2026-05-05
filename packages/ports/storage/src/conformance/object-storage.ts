import { describe, expect, it } from 'vitest';

import type { ObjectStoragePort } from '../object-storage.port.js';

export function runObjectStorageConformance(
  name: string,
  factory: () => Promise<ObjectStoragePort>,
): void {
  describe(`${name} — ObjectStoragePort conformance`, () => {
    // ── head ──────────────────────────────────────────────────────────────────

    it('head returns null for a nonexistent key', async () => {
      const storage = await factory();
      const result = await storage.head('nonexistent/key.txt');
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toBeNull();
    });

    it('put then head returns object info with correct size', async () => {
      const storage = await factory();
      const key = `test/${String(Date.now())}.txt`;
      const data = Buffer.from('hello world');
      const putResult = await storage.put(key, data, { contentType: 'text/plain' });
      expect(putResult.isOk()).toBe(true);
      const headResult = await storage.head(key);
      const headInfo = headResult._unsafeUnwrap();
      expect(headInfo).not.toBeNull();
      expect(headInfo?.size).toBe(data.length);
    });

    // ── put / get ─────────────────────────────────────────────────────────────

    it('put then get returns the data', async () => {
      const storage = await factory();
      const key = `test/${String(Date.now())}-get.txt`;
      const content = 'get test content';
      await storage.put(key, Buffer.from(content));
      const getResult = await storage.get(key);
      expect(getResult.isOk()).toBe(true);
      const stream = getResult._unsafeUnwrap();
      const chunks: Buffer[] = [];
      await new Promise<void>((resolve, reject) => {
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('end', resolve);
        stream.on('error', reject);
      });
      expect(Buffer.concat(chunks).toString('utf8')).toBe(content);
    });

    it('put returns an etag', async () => {
      const storage = await factory();
      const key = `test/${String(Date.now())}-etag.txt`;
      const result = await storage.put(key, Buffer.from('etag check'));
      expect(result.isOk()).toBe(true);
      // ETag may or may not be present depending on the adapter; if present it must be a string
      const info = result._unsafeUnwrap();
      if (info.etag !== undefined) {
        expect(typeof info.etag).toBe('string');
        expect(info.etag.length).toBeGreaterThan(0);
      }
    });

    it('put overwrites an existing object with the same key', async () => {
      const storage = await factory();
      const key = `test/${String(Date.now())}-overwrite.txt`;
      await storage.put(key, Buffer.from('original'));
      await storage.put(key, Buffer.from('updated'));
      const get = await storage.get(key);
      const chunks: Buffer[] = [];
      for await (const chunk of get._unsafeUnwrap() as AsyncIterable<Buffer>) {
        chunks.push(chunk);
      }
      expect(Buffer.concat(chunks).toString()).toBe('updated');
    });

    // ── get error ─────────────────────────────────────────────────────────────

    it('get returns OBJECT_NOT_FOUND for a nonexistent key', async () => {
      const storage = await factory();
      const result = await storage.get('does-not-exist/file.txt');
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('OBJECT_NOT_FOUND');
    });

    // ── delete ────────────────────────────────────────────────────────────────

    it('delete succeeds for an existing object', async () => {
      const storage = await factory();
      const key = `test/${String(Date.now())}-delete.txt`;
      await storage.put(key, Buffer.from('to delete'));
      const result = await storage.delete(key);
      expect(result.isOk()).toBe(true);
    });

    it('delete is idempotent: deleting a nonexistent key succeeds', async () => {
      const storage = await factory();
      const result = await storage.delete('nonexistent/ghost.txt');
      expect(result.isOk()).toBe(true);
    });

    it('head returns null after deleting a key', async () => {
      const storage = await factory();
      const key = `test/${String(Date.now())}-after-delete.txt`;
      await storage.put(key, Buffer.from('temp'));
      await storage.delete(key);
      const result = await storage.head(key);
      expect(result._unsafeUnwrap()).toBeNull();
    });

    // ── list ──────────────────────────────────────────────────────────────────

    it('list with prefix returns matching objects in alphabetical order', async () => {
      const storage = await factory();
      const prefix = `list-test-${String(Date.now())}/`;
      await storage.put(`${prefix}c.txt`, Buffer.from('c'));
      await storage.put(`${prefix}a.txt`, Buffer.from('a'));
      await storage.put(`${prefix}b.txt`, Buffer.from('b'));
      const result = await storage.list(prefix);
      expect(result.isOk()).toBe(true);
      const keys = result._unsafeUnwrap().objects.map((o) => o.key);
      expect(keys.length).toBeGreaterThanOrEqual(3);
      const sorted = [...keys].sort();
      expect(keys).toEqual(sorted);
    });

    it('list with maxKeys limits the result', async () => {
      const storage = await factory();
      const prefix = `list-max-${String(Date.now())}/`;
      await storage.put(`${prefix}1.txt`, Buffer.from('1'));
      await storage.put(`${prefix}2.txt`, Buffer.from('2'));
      await storage.put(`${prefix}3.txt`, Buffer.from('3'));
      const result = await storage.list(prefix, { maxKeys: 2 });
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().objects.length).toBeLessThanOrEqual(2);
    });

    it('list returns empty array for prefix with no matches', async () => {
      const storage = await factory();
      const result = await storage.list(`no-match-prefix-${String(Date.now())}/`);
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().objects).toHaveLength(0);
    });

    it('list does not return objects outside the prefix', async () => {
      const storage = await factory();
      const prefix = `isolate-${String(Date.now())}/`;
      await storage.put(`${prefix}inside.txt`, Buffer.from('in'));
      await storage.put(`other-${String(Date.now())}/outside.txt`, Buffer.from('out'));
      const result = await storage.list(prefix);
      expect(result._unsafeUnwrap().objects.every((o) => o.key.startsWith(prefix))).toBe(true);
    });

    // ── signed URLs ───────────────────────────────────────────────────────────

    it('signedUrl returns a URL string when supported', async () => {
      const storage = await factory();
      if (!storage.supports('signed_urls')) return; // skip if not supported

      const key = `test/${String(Date.now())}-signed.txt`;
      await storage.put(key, Buffer.from('sign me'));
      const result = await storage.signedUrl(key, 'GET', { expiresIn: 300 });
      expect(result.isOk()).toBe(true);
      expect(typeof result._unsafeUnwrap()).toBe('string');
      expect(result._unsafeUnwrap().length).toBeGreaterThan(0);
    });

    // ── supports ──────────────────────────────────────────────────────────────

    it('supports returns a boolean for all known feature flags', async () => {
      const storage = await factory();
      const features = [
        'signed_urls',
        'multipart',
        'versioning',
        'object_locks',
        'public_read',
      ] as const;
      for (const f of features) {
        expect(typeof storage.supports(f)).toBe('boolean');
      }
    });

    // ── large objects (stress) ────────────────────────────────────────────────

    it('handles 1 MB object correctly', async () => {
      const storage = await factory();
      const key = `test/${String(Date.now())}-1mb.bin`;
      const data = Buffer.alloc(1024 * 1024, 0x42);
      const putResult = await storage.put(key, data);
      expect(putResult.isOk()).toBe(true);
      expect(putResult._unsafeUnwrap().size).toBe(data.length);

      const headResult = await storage.head(key);
      expect(headResult._unsafeUnwrap()?.size).toBe(data.length);

      await storage.delete(key);
    });
  });
}
