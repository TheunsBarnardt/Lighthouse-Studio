import { describe, it, expect, vi } from 'vitest';

import type { InternalRevocationEvent } from './types.js';

import { InProcessEventBus } from './internal-event-bus.js';

describe('InProcessEventBus', () => {
  it('delivers events to all subscribers', () => {
    const bus = new InProcessEventBus();
    const received1: InternalRevocationEvent[] = [];
    const received2: InternalRevocationEvent[] = [];

    bus.subscribe((e) => received1.push(e));
    bus.subscribe((e) => received2.push(e));

    const event: InternalRevocationEvent = {
      kind: 'session.revoked',
      sessionId: 's1',
      userId: 'u1',
    };
    bus.publish(event);

    expect(received1).toHaveLength(1);
    expect(received1[0]).toStrictEqual(event);
    expect(received2).toHaveLength(1);
  });

  it('unsubscribe stops delivery', () => {
    const bus = new InProcessEventBus();
    const received: InternalRevocationEvent[] = [];

    const unsub = bus.subscribe((e) => received.push(e));
    unsub();

    bus.publish({ kind: 'session.revoked', sessionId: 's1', userId: 'u1' });

    expect(received).toHaveLength(0);
  });

  it('does not propagate handler exceptions to other handlers', () => {
    const bus = new InProcessEventBus();
    const received: InternalRevocationEvent[] = [];

    bus.subscribe(() => {
      throw new Error('handler exploded');
    });
    bus.subscribe((e) => received.push(e));

    bus.publish({ kind: 'api_key.revoked', keyId: 'k1' });

    expect(received).toHaveLength(1);
  });

  it('delivers workspace.member_removed events', () => {
    const bus = new InProcessEventBus();
    const handler = vi.fn();
    bus.subscribe(handler);

    bus.publish({ kind: 'workspace.member_removed', userId: 'u2', workspaceId: 'ws1' });

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith({
      kind: 'workspace.member_removed',
      userId: 'u2',
      workspaceId: 'ws1',
    });
  });
});
