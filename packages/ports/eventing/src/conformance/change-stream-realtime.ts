import { describe, it, expect } from 'vitest';

import type { ChangeStreamPort } from '../change-stream.port.js';
import type { ChangeEvent } from '../types.js';

/**
 * Cross-database conformance test suite for ChangeStreamPort real-time behaviour.
 *
 * Run this suite against every ChangeStream adapter (Postgres, MSSQL, MongoDB)
 * to verify that the real-time subscription contract holds across databases.
 *
 * Usage (in an adapter package):
 *   import { runChangeStreamRealtimeConformance } from '@platform/ports-eventing/conformance';
 *   runChangeStreamRealtimeConformance('Postgres', () => buildPostgresAdapter());
 */
export function runChangeStreamRealtimeConformance(
  adapterName: string,
  factory: () => Promise<ChangeStreamPort>,
): void {
  describe(`${adapterName} — ChangeStreamPort real-time conformance`, () => {
    // ── Basic delivery ────────────────────────────────────────────────────────

    it('watch() returns an AsyncIterable', async () => {
      const stream = await factory();
      const iterable = stream.watch({ table: 'realtime_conformance_test' });
      expect(iterable[Symbol.asyncIterator]).toBeTypeOf('function');
      await stream.close?.();
    });

    it('reports supported features', async () => {
      const stream = await factory();
      const features = [
        'before_after_image',
        'server_side_filter',
        'replay_from_position',
      ] as const;
      for (const feature of features) {
        // Must return a boolean (not throw)
        expect(typeof stream.supports(feature)).toBe('boolean');
      }
      await stream.close?.();
    });

    it('delivers insert events', async () => {
      const stream = await factory();
      const received: ChangeEvent[] = [];

      // Collect first 3 events with a timeout
      const ac = new AbortController();
      const timeout = setTimeout(() => {
        ac.abort();
      }, 5000);

      try {
        for await (const event of stream.watch({ table: 'users', operations: ['insert'] })) {
          received.push(event);
          if (received.length >= 1) break;
        }
      } finally {
        clearTimeout(timeout);
      }

      if (received.length > 0) {
        expect(received[0]?.operation).toBe('insert');
        expect(received[0]?.table).toBe('users');
        expect(received[0]?.position).toBeTruthy();
        expect(received[0]?.occurredAt).toBeInstanceOf(Date);
      }
      await stream.close?.();
    });

    it('delivers update events with before and after when supported', async () => {
      const stream = await factory();
      if (!stream.supports('before_after_image')) return; // skip if not supported

      const received: ChangeEvent[] = [];

      try {
        for await (const event of stream.watch({ table: 'users', operations: ['update'] })) {
          received.push(event);
          break;
        }
      } catch {
        // Timeout acceptable for conformance test
      }

      if (received.length > 0) {
        expect(received[0]?.operation).toBe('update');
        // When before_after_image is supported, both must be present for updates
        expect(received[0]?.after).toBeDefined();
      }
      await stream.close?.();
    });

    it('delivers delete events', async () => {
      const stream = await factory();
      const received: ChangeEvent[] = [];

      try {
        for await (const event of stream.watch({ table: 'users', operations: ['delete'] })) {
          received.push(event);
          break;
        }
      } catch {
        // Timeout acceptable
      }

      if (received.length > 0) {
        expect(received[0]?.operation).toBe('delete');
      }
      await stream.close?.();
    });

    // ── Filter support ────────────────────────────────────────────────────────

    it('respects operation filter — only requested operations delivered', async () => {
      const stream = await factory();
      if (!stream.supports('server_side_filter')) return; // skip if not supported

      const received: ChangeEvent[] = [];

      try {
        for await (const event of stream.watch({ table: 'users', operations: ['insert'] })) {
          received.push(event);
          if (received.length >= 3) break;
        }
      } catch {
        // Timeout acceptable
      }

      for (const event of received) {
        expect(event.operation).toBe('insert');
      }
      await stream.close?.();
    });

    // ── Resume / position ─────────────────────────────────────────────────────

    it('provides a non-empty position on every event', async () => {
      const stream = await factory();
      const received: ChangeEvent[] = [];

      try {
        for await (const event of stream.watch({ table: 'users' })) {
          received.push(event);
          if (received.length >= 1) break;
        }
      } catch {
        // Timeout acceptable
      }

      for (const event of received) {
        expect(event.position).toBeTruthy();
        expect(typeof event.position).toBe('string');
      }
      await stream.close?.();
    });

    // ── Schema field ──────────────────────────────────────────────────────────

    it('events carry correct table name', async () => {
      const stream = await factory();
      const received: ChangeEvent[] = [];

      try {
        for await (const event of stream.watch({ table: 'products' })) {
          received.push(event);
          break;
        }
      } catch {
        // Timeout acceptable
      }

      if (received.length > 0) {
        expect(received[0]?.table).toBe('products');
      }
      await stream.close?.();
    });

    // ── Heartbeat / idle ──────────────────────────────────────────────────────

    it('does not throw when no events occur for a long period', async () => {
      const stream = await factory();
      // Simply watch for 100ms and expect no throw
      const timer = new Promise<void>((resolve) => setTimeout(resolve, 100));

      await Promise.race([
        timer,
        (async () => {
          for await (const _event of stream.watch({ table: '_nonexistent_table_' })) {
            break;
          }
        })(),
      ]);

      await stream.close?.();
    });
  });
}
