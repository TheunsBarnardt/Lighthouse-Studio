import { describe, expect, it, vi } from 'vitest';

import type { EventBusPort } from '../event-bus.port.js';

export function runEventBusConformance(name: string, factory: () => Promise<EventBusPort>): void {
  describe(`${name} — EventBusPort conformance`, () => {
    it('publish returns ok', async () => {
      const bus = await factory();
      const result = await bus.publish('test.topic', { hello: 'world' });
      expect(result.isOk()).toBe(true);
    });

    it('subscribe then publish delivers the event', async () => {
      const bus = await factory();
      const received: unknown[] = [];
      const sub = await bus.subscribe<{ value: number }>('delivery.test', (event) => {
        received.push(event);
        return Promise.resolve(undefined);
      });
      expect(sub.isOk()).toBe(true);

      await bus.publish('delivery.test', { value: 42 });
      // Allow microtasks to flush
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(received).toHaveLength(1);
      expect((received[0] as { value: number }).value).toBe(42);

      await sub._unsafeUnwrap().unsubscribe();
    });

    it('unsubscribed handler does not receive further events', async () => {
      const bus = await factory();
      const handler = vi.fn();
      const sub = await bus.subscribe('unsub.test', () => {
        handler();
        return Promise.resolve(undefined);
      });
      await sub._unsafeUnwrap().unsubscribe();

      await bus.publish('unsub.test', { data: true });
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(handler).not.toHaveBeenCalled();
    });
  });
}
