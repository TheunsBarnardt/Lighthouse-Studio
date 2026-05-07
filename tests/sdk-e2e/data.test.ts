/**
 * SDK E2E — Data client (DoD 7–10, Objective 19)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { E2E_ENABLED, makeClient, testCredentials } from './helpers.js';

describe.skipIf(!E2E_ENABLED)('Data E2E', () => {
  const client = makeClient();
  let insertedId = '';

  beforeAll(async () => {
    await client.auth.signIn(testCredentials);
  });

  afterAll(async () => {
    if (insertedId) {
      await client
        .data('e2e_items')
        .where({ id: { _eq: insertedId } })
        .delete();
    }
    await client.auth.signOut();
  });

  it('DoD-8: INSERT creates a row and returns server state', async () => {
    const result = await client.data('e2e_items').insert({ name: 'sdk-e2e-test' });
    expect(result.data).toBeTruthy();
    const { data } = await client.data('e2e_items').where({ name: { _eq: 'sdk-e2e-test' } });
    insertedId = (data[0] as { id: string }).id;
    expect(insertedId).toBeTruthy();
  });

  it('DoD-7: SELECT with filter returns typed results', async () => {
    const { data } = await client
      .data('e2e_items')
      .select('id', 'name')
      .where({ id: { _eq: insertedId } });
    expect(data).toHaveLength(1);
    expect((data[0] as { name: string }).name).toBe('sdk-e2e-test');
  });

  it('DoD-9: UPDATE with optimistic locking detects conflict', async () => {
    const { data } = await client
      .data('e2e_items')
      .select('id', 'version')
      .where({ id: { _eq: insertedId } });
    const staleVersion = (data[0] as { version: number }).version;

    // Bump version once
    await client
      .data('e2e_items')
      .where({ id: { _eq: insertedId } })
      .update({ name: 'updated-once' });

    // Retry with stale version — server should reject
    try {
      await client
        .data('e2e_items')
        .where({ id: { _eq: insertedId } })
        .update({ name: 'conflict', version: staleVersion });
      expect.fail('expected VERSION_MISMATCH error');
    } catch (err) {
      expect((err as { code?: string }).code).toBe('VERSION_MISMATCH');
    }
  });
});
