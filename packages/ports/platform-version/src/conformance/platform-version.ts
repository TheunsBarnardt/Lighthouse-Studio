import { describe, expect, it } from 'vitest';

import type { PlatformVersionPort } from '../platform-version.port.js';

export function runPlatformVersionConformance(
  name: string,
  factory: () => Promise<PlatformVersionPort>,
): void {
  describe(`${name} — PlatformVersionPort conformance`, () => {
    // ── current / fresh install ──────────────────────────────────────────────

    it('current() returns null on a fresh install (no rows)', async () => {
      const port = await factory();
      const result = await port.current();
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toBeNull();
    });

    // ── record ───────────────────────────────────────────────────────────────

    it('record() writes a row that current() then returns', async () => {
      const port = await factory();
      const r = await port.record({ releaseVersion: '1.0.0' });
      expect(r.isOk()).toBe(true);

      const curr = await port.current();
      expect(curr.isOk()).toBe(true);
      const v = curr._unsafeUnwrap();
      expect(v).not.toBeNull();
      expect(v?.releaseVersion).toBe('1.0.0');
      expect(v?.appliedAt).toBeInstanceOf(Date);
    });

    it('record() stores optional fields when provided', async () => {
      const port = await factory();
      await port.record({
        releaseVersion: '1.1.0',
        appliedBy: 'user-123',
        schemaMigrationHighWater: '0009_platform_versions',
        notes: 'upgrade test',
      });
      const curr = await port.current();
      const v = curr._unsafeUnwrap();
      expect(v?.appliedBy).toBe('user-123');
      expect(v?.schemaMigrationHighWater).toBe('0009_platform_versions');
      expect(v?.notes).toBe('upgrade test');
    });

    // ── history ───────────────────────────────────────────────────────────────

    it('history() returns all rows newest first', async () => {
      const port = await factory();
      await port.record({ releaseVersion: '1.0.0' });
      await port.record({ releaseVersion: '1.1.0' });
      await port.record({ releaseVersion: '1.2.0' });

      const h = await port.history();
      expect(h.isOk()).toBe(true);
      const rows = h._unsafeUnwrap();
      expect(rows.length).toBe(3);
      expect(rows[0]?.releaseVersion).toBe('1.2.0');
      expect(rows[1]?.releaseVersion).toBe('1.1.0');
      expect(rows[2]?.releaseVersion).toBe('1.0.0');
    });

    it('current() returns the latest row after multiple records', async () => {
      const port = await factory();
      await port.record({ releaseVersion: '1.0.0' });
      await port.record({ releaseVersion: '1.1.0' });

      const curr = await port.current();
      expect(curr._unsafeUnwrap()?.releaseVersion).toBe('1.1.0');
    });

    // ── rollback ──────────────────────────────────────────────────────────────

    it('rollback() removes the latest row and returns it', async () => {
      const port = await factory();
      await port.record({ releaseVersion: '1.0.0' });
      await port.record({ releaseVersion: '1.1.0' });

      const r = await port.rollback();
      expect(r.isOk()).toBe(true);
      expect(r._unsafeUnwrap().releaseVersion).toBe('1.1.0');

      const curr = await port.current();
      expect(curr._unsafeUnwrap()?.releaseVersion).toBe('1.0.0');
    });

    it('rollback() on a single row leaves the table empty', async () => {
      const port = await factory();
      await port.record({ releaseVersion: '1.0.0' });

      const r = await port.rollback();
      expect(r.isOk()).toBe(true);
      expect(r._unsafeUnwrap().releaseVersion).toBe('1.0.0');

      const curr = await port.current();
      expect(curr._unsafeUnwrap()).toBeNull();
    });

    it('rollback() errors with NOTHING_TO_ROLLBACK when table is empty', async () => {
      const port = await factory();
      const r = await port.rollback();
      expect(r.isErr()).toBe(true);
      expect(r._unsafeUnwrapErr().code).toBe('NOTHING_TO_ROLLBACK');
    });
  });
}
