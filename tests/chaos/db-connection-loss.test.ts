/**
 * Chaos Scenario 1: Database connection loss
 *
 * Kills the database for 30 seconds.
 * Verifies: graceful error handling; retry on reconnect; no data corruption.
 */

import { beforeAll, describe, expect, it } from 'vitest';

import {
  chaosEnabled,
  checkDataCorruption,
  config,
  dockerKill,
  dockerStart,
  platformGet,
  platformHealthy,
  requireChaosEnv,
  signIn,
  verifyAuditChainIntegrity,
  waitFor,
} from './helpers.js';

describe('Chaos: DB connection loss', () => {
  let token: string | null = null;
  let workspaceId: string | null = null;

  beforeAll(async () => {
    requireChaosEnv();
    if (!chaosEnabled) return;

    token = await signIn('load-test-user-00001@loadtest.internal', 'LoadTest1!');
    expect(token, 'sign-in before chaos must succeed').toBeTruthy();

    const listRes = await platformGet('/api/workspaces?limit=1', token!);
    expect(listRes.ok).toBe(true);
    const data = (await listRes.json()) as { data: Array<{ id: string }> };
    workspaceId = data.data[0]?.id ?? null;
    expect(workspaceId, 'need at least one workspace').toBeTruthy();
  });

  it('handles DB loss gracefully and recovers', async () => {
    if (!chaosEnabled) return;

    // 1. Verify platform is healthy before injection
    expect(await platformHealthy()).toBe(true);

    // 2. Inject: kill database container
    console.log('  → Killing database container...');
    dockerKill(config.dbContainerName);
    const killedAt = Date.now();

    // 3. During outage: platform should return 503/500, not crash
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const duringRes = await platformGet('/api/workspaces', token!);
    expect([500, 502, 503, 504]).toContain(duringRes.status);
    console.log(`  → Platform responded with ${duringRes.status} during DB outage (correct)`);

    // 4. Wait 30s then restore DB
    await new Promise((resolve) => setTimeout(resolve, 30_000));
    console.log('  → Restoring database container...');
    dockerStart(config.dbContainerName);

    // 5. Platform should recover within 60s
    const recovered = await waitFor(async () => {
      const r = await platformGet('/api/workspaces', token!);
      return r.ok;
    }, 60_000);
    expect(recovered, 'platform should recover within 60s of DB restart').toBe(true);
    const recoveryTime = Date.now() - killedAt - 30_000;
    console.log(`  → Recovered in ${recoveryTime}ms after DB restart`);

    // 6. No data corruption
    const corrupted = await checkDataCorruption(workspaceId!, token!);
    expect(corrupted, 'no data corruption after DB loss').toBe(false);

    // 7. Audit chain still valid
    const chain = await verifyAuditChainIntegrity(workspaceId!, token!);
    expect(chain.valid, 'audit chain intact after DB loss').toBe(true);
  }, 120_000);
});
