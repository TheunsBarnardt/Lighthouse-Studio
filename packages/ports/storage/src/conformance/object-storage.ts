import { describe, expect, it } from 'vitest';

import type { ObjectStoragePort } from '../object-storage.port.js';

export function runObjectStorageConformance(
  name: string,
  factory: () => Promise<ObjectStoragePort>,
): void {
  describe(`${name} — ObjectStoragePort conformance`, () => {
    it('head returns null for a nonexistent key', async () => {
      const storage = await factory();
      const result = await storage.head('nonexistent/key.txt');
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toBeNull();
    });

    it('put then head returns object info', async () => {
      const storage = await factory();
      const key = `test/${String(Date.now())}.txt`;
      const data = Buffer.from('hello world');
      const putResult = await storage.put(key, data, { contentType: 'text/plain' });
      expect(putResult.isOk()).toBe(true);
      const headResult = await storage.head(key);
      expect(headResult._unsafeUnwrap()).not.toBeNull();
    });

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

    it('get returns ObjectNotFoundError for a nonexistent key', async () => {
      const storage = await factory();
      const result = await storage.get('does-not-exist/file.txt');
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('OBJECT_NOT_FOUND');
    });

    it('delete succeeds for an existing object', async () => {
      const storage = await factory();
      const key = `test/${String(Date.now())}-delete.txt`;
      await storage.put(key, Buffer.from('to delete'));
      const result = await storage.delete(key);
      expect(result.isOk()).toBe(true);
    });

    it('list with prefix returns matching objects', async () => {
      const storage = await factory();
      const prefix = `list-test-${String(Date.now())}/`;
      await storage.put(`${prefix}a.txt`, Buffer.from('a'));
      await storage.put(`${prefix}b.txt`, Buffer.from('b'));
      const result = await storage.list(prefix);
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().objects.length).toBeGreaterThanOrEqual(2);
    });
  });
}
