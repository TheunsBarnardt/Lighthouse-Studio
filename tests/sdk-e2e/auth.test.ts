import type { Session } from '@platform/sdk';

/**
 * SDK E2E — Auth (DoD 2–6, Objective 19)
 * Requires: PLATFORM_URL, PLATFORM_ANON_KEY, PLATFORM_TEST_EMAIL, PLATFORM_TEST_PASSWORD
 * Run: PLATFORM_URL=http://localhost:3000 pnpm test:sdk-e2e
 */
import { describe, it, expect, afterAll } from 'vitest';

import { E2E_ENABLED, makeClient, testCredentials } from './helpers.js';

describe.skipIf(!E2E_ENABLED)('Auth E2E', () => {
  const client = makeClient();

  afterAll(async () => {
    await client.auth.signOut();
  });

  it('DoD-2: email + password sign-in succeeds', async () => {
    const result = await client.auth.signIn(testCredentials);
    expect('session' in result).toBe(true);
    if ('session' in result) {
      expect(result.session.accessToken).toBeTruthy();
      expect(result.user.email).toBe(testCredentials.email);
    }
  });

  it('DoD-5: session refresh is transparent', async () => {
    await client.auth.signIn(testCredentials);
    const refreshed: Session = await client.auth.refreshSession();
    expect(refreshed.accessToken).toBeTruthy();
  });

  it('DoD-6: onAuthStateChange fires on sign-in and sign-out', async () => {
    const events: string[] = [];
    const unsub = client.auth.onAuthStateChange((event: string) => {
      events.push(event);
    });

    await client.auth.signIn(testCredentials);
    await client.auth.signOut();
    unsub();

    expect(events).toContain('SIGNED_IN');
    expect(events).toContain('SIGNED_OUT');
  });
});
