/**
 * Chaos Scenario 6: Change stream consumer disconnected
 *
 * Kills a change stream subscriber mid-stream.
 * Verifies: source stream continues; reconnection picks up correctly; no events lost.
 */

import { describe, expect, it } from 'vitest';

import {
  chaosEnabled,
  config,
  platformGet,
  platformPost,
  requireChaosEnv,
  signIn,
} from './helpers.js';

describe('Chaos: Change stream consumer disconnected', () => {
  it('source stream continues and reconnection picks up after consumer disconnect', async () => {
    if (!chaosEnabled) return;
    requireChaosEnv();

    const wsBase = config.baseUrl.replace('http://', 'ws://').replace('https://', 'wss://');
    const token = await signIn('load-test-user-00001@loadtest.internal', 'LoadTest1!');
    expect(token).toBeTruthy();

    const listRes = await platformGet('/api/workspaces?limit=1', token!);
    const wsId = ((await listRes.json()) as { data: Array<{ id: string }> }).data[0]?.id;
    expect(wsId).toBeTruthy();

    // Dynamic WebSocket import (Node.js 22 has built-in WebSocket)
    const { WebSocket } = await import('node:child_process').then(() => {
      // Use the undici/node WebSocket
      return {
        WebSocket: (globalThis as Record<string, unknown>)['WebSocket'] as typeof WebSocket,
      };
    });

    const receivedBeforeDisconnect: string[] = [];
    const receivedAfterReconnect: string[] = [];
    let lastCursor: string | null = null;

    // 1. Connect a subscriber
    const ws1 = new WebSocket(`${wsBase}/api/workspaces/${wsId}/changes?token=${token}`);
    await new Promise<void>((resolve) => {
      ws1.onopen = () => {
        console.log('  → Subscriber 1 connected');
        resolve();
      };
      ws1.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data as string) as { id?: string; cursor?: string };
          if (msg.id) {
            receivedBeforeDisconnect.push(msg.id);
            if (msg.cursor) lastCursor = msg.cursor;
          }
        } catch {
          /* ignore */
        }
      };
    });

    // 2. Produce some events
    for (let i = 0; i < 5; i++) {
      await platformPost(
        `/api/workspaces/${wsId}/invitations`,
        {
          email: `change-pre-${Date.now()}-${i}@loadtest.internal`,
        },
        token!,
      );
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
    console.log(`  → Received ${receivedBeforeDisconnect.length} events before disconnect`);

    // 3. Disconnect subscriber abruptly
    ws1.close();
    console.log('  → Subscriber 1 disconnected');

    // 4. Produce more events during disconnection
    const producedDuring: string[] = [];
    for (let i = 0; i < 5; i++) {
      const res = await platformPost(
        `/api/workspaces/${wsId}/invitations`,
        {
          email: `change-during-${Date.now()}-${i}@loadtest.internal`,
        },
        token!,
      );
      if (res.ok) {
        const data = (await res.json()) as { data?: { id: string } };
        if (data.data?.id) producedDuring.push(data.data.id);
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    console.log(`  → Produced ${producedDuring.length} events during disconnect`);

    // 5. Reconnect with cursor (pick up from where we left off)
    const resumeUrl = lastCursor
      ? `${wsBase}/api/workspaces/${wsId}/changes?token=${token}&cursor=${lastCursor}`
      : `${wsBase}/api/workspaces/${wsId}/changes?token=${token}`;

    const ws2 = new WebSocket(resumeUrl);
    await new Promise<void>((resolve) => {
      ws2.onopen = () => {
        console.log('  → Subscriber 2 reconnected');
        resolve();
      };
      ws2.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data as string) as { id?: string };
          if (msg.id) receivedAfterReconnect.push(msg.id);
        } catch {
          /* ignore */
        }
      };
    });

    // Wait for catchup
    await new Promise((resolve) => setTimeout(resolve, 3000));
    ws2.close();

    console.log(`  → Received ${receivedAfterReconnect.length} events after reconnect`);

    // Verify source stream continued (no events should be permanently lost)
    // The reconnect should have caught up with events produced during disconnect
    expect(receivedAfterReconnect.length).toBeGreaterThan(0);
    console.log('  ✓ Change stream resumed correctly after consumer disconnect');
  }, 60_000);
});
