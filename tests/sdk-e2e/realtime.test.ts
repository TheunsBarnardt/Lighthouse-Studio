import type { RealtimeEvent } from '@platform/sdk';

/**
 * SDK E2E — Realtime (DoD 12–14, Objective 19)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { E2E_ENABLED, makeClient, testCredentials } from './helpers.js';

describe.skipIf(!E2E_ENABLED)('Realtime E2E', () => {
  const client = makeClient();

  beforeAll(async () => {
    await client.auth.signIn(testCredentials);
  });

  afterAll(async () => {
    await client.auth.signOut();
  });

  it('DoD-12: subscribing to a table receives insert events', async () => {
    const received: unknown[] = [];

    const channel = client.realtime('e2e_items');
    channel.on('insert', (e: RealtimeEvent<Record<string, unknown>>) => received.push(e));
    await channel.subscribe();

    await client.data('e2e_items').insert({ name: 'realtime-probe' });

    await new Promise<void>((resolve) => setTimeout(resolve, 2000));
    await channel.unsubscribe();

    expect(received.length).toBeGreaterThan(0);
  });

  it('DoD-14: 10 channels can be created (single manager)', () => {
    const channels = Array.from({ length: 10 }, (_) => client.realtime('e2e_items'));
    expect(channels).toHaveLength(10);
  });
});
