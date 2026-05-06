/**
 * SDK E2E — Query console (DoD 18–19, Objective 19)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { E2E_ENABLED, makeClient, testCredentials } from './helpers.js';

describe.skipIf(!E2E_ENABLED)('Query E2E', () => {
  const client = makeClient();

  beforeAll(async () => {
    await client.auth.signIn(testCredentials);
  });

  afterAll(async () => {
    await client.auth.signOut();
  });

  it('DoD-18: execute a SELECT returns expected rows', async () => {
    const result = await client.query.execute('SELECT 1 AS value');
    expect(result.rows).toHaveLength(1);
    expect((result.rows[0] as Record<string, unknown>)['value']).toBe(1);
  });

  it('DoD-19: write attempt without query.write permission fails clearly', async () => {
    const readonlyEmail = process.env['PLATFORM_READONLY_EMAIL'];
    if (!readonlyEmail) return;

    const roClient = makeClient();
    await roClient.auth.signIn({
      email: readonlyEmail,
      password: process.env['PLATFORM_READONLY_PASSWORD'] ?? '',
    });

    await expect(
      roClient.query.execute("INSERT INTO e2e_items (name) VALUES ('forbidden')"),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    await roClient.auth.signOut();
  });
});
