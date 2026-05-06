import { describe, it, expect, vi } from 'vitest';

import { AuthClient } from '../src/auth/index.js';
import { setRuntime } from '../src/runtime/index.js';
import { HttpTransport } from '../src/transport/index.js';

function makeTransport(responses: Array<{ status: number; body?: unknown }>): HttpTransport {
  let i = 0;
  const fetchMock = vi.fn(async () => {
    const r = responses[i++] ?? { status: 200, body: {} };
    const hasBody = r.status !== 204 && r.body !== undefined;
    return new Response(hasBody ? JSON.stringify(r.body) : null, {
      status: r.status,
      headers: hasBody ? { 'Content-Type': 'application/json' } : {},
    });
  });
  setRuntime({ fetch: fetchMock as never, WebSocket: class {} as never, isBrowser: false });
  return new HttpTransport({ baseUrl: 'http://localhost:3000', retry: { maxAttempts: 1 } });
}

describe('AuthClient', () => {
  it('stores session after signIn', async () => {
    const session = {
      accessToken: 'tok',
      refreshToken: 'ref',
      expiresAt: Date.now() + 3_600_000,
      userId: 'u1',
      workspaceId: 'w1',
    };
    const transport = makeTransport([{ status: 200, body: { session, user: { id: 'u1' } } }]);
    const auth = new AuthClient({ transport, storageStrategy: 'memory' });

    const result = await auth.signIn({ email: 'a@b.com', password: 'pass' });
    expect('session' in result).toBe(true);
    expect(auth.getSession()?.accessToken).toBe('tok');
    expect(auth.getToken()).toBe('tok');
  });

  it('returns null session when not signed in', () => {
    const transport = makeTransport([]);
    const auth = new AuthClient({ transport, storageStrategy: 'memory' });
    expect(auth.getSession()).toBeNull();
    expect(auth.getToken()).toBeNull();
  });

  it('clears session on signOut', async () => {
    const session = {
      accessToken: 'tok',
      refreshToken: 'ref',
      expiresAt: Date.now() + 3_600_000,
      userId: 'u1',
      workspaceId: 'w1',
    };
    const transport = makeTransport([
      { status: 200, body: { session, user: { id: 'u1' } } },
      { status: 204 },
    ]);
    const auth = new AuthClient({ transport, storageStrategy: 'memory' });
    await auth.signIn({ email: 'a@b.com', password: 'pass' });
    await auth.signOut();

    expect(auth.getSession()).toBeNull();
  });

  it('emits auth state events', async () => {
    const session = {
      accessToken: 'tok',
      refreshToken: 'ref',
      expiresAt: Date.now() + 3_600_000,
      userId: 'u1',
      workspaceId: 'w1',
    };
    const transport = makeTransport([
      { status: 200, body: { session, user: { id: 'u1' } } },
      { status: 204 },
    ]);
    const auth = new AuthClient({ transport, storageStrategy: 'memory' });

    const events: string[] = [];
    auth.onAuthStateChange((event) => events.push(event));

    await auth.signIn({ email: 'a@b.com', password: 'pass' });
    await auth.signOut();

    expect(events).toContain('SIGNED_IN');
    expect(events).toContain('SIGNED_OUT');
  });

  it('unsubscribes auth state listener', async () => {
    const transport = makeTransport([{ status: 204 }]);
    const auth = new AuthClient({ transport, storageStrategy: 'memory' });

    const events: string[] = [];
    const unsub = auth.onAuthStateChange((event) => events.push(event));
    unsub();

    await auth.signOut();
    expect(events).toHaveLength(0);
  });

  it('returns null for expired session', () => {
    const transport = makeTransport([]);
    const auth = new AuthClient({ transport, storageStrategy: 'memory' });

    // Manually inject an expired session
    (auth as unknown as { storage: { setSession: (s: unknown) => void } }).storage.setSession({
      accessToken: 'expired',
      refreshToken: 'ref',
      expiresAt: Date.now() - 1000, // expired 1s ago
      userId: 'u1',
      workspaceId: 'w1',
    });

    expect(auth.getSession()).toBeNull();
  });
});
