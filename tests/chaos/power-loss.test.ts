/**
 * Chaos Scenario 10: Power loss simulation
 *
 * Hard-stops the database VM/container during a write; then restarts.
 * Verifies: DB recovers; no audit chain breakage; no data corruption.
 *
 * This is the most severe scenario — simulates ungraceful shutdown.
 */

import { describe, expect, it } from 'vitest';

import {
  chaosEnabled,
  checkDataCorruption,
  config,
  dockerKill,
  dockerStart,
  platformGet,
  platformHealthy,
  platformPost,
  requireChaosEnv,
  signIn,
  verifyAuditChainIntegrity,
} from './helpers.js';

describe('Chaos: Power loss simulation', () => {
  it('database recovers cleanly after hard stop during write', async () => {
    if (!chaosEnabled) return;
    requireChaosEnv();

    const token = await signIn('load-test-user-00001@loadtest.internal', 'LoadTest1!');
    expect(token).toBeTruthy();

    const listRes = await platformGet('/api/workspaces?limit=1', token!);
    const wsId = ((await listRes.json()) as { data: Array<{ id: string }> }).data[0]?.id;
    expect(wsId).toBeTruthy();

    // Start a write and immediately hard-kill the DB (SIGKILL, no flush)
    const writePromise = platformPost(
      `/api/workspaces/${wsId}/invitations`,
      { email: `power-loss-${Date.now()}@loadtest.internal` },
      token!,
    ).catch(() => null);

    // Hard-kill with no graceful shutdown window
    await new Promise((resolve) => setTimeout(resolve, 50)); // brief window for request to be in-flight
    console.log('  → SIGKILL to database container (power loss simulation)...');
    dockerKill(config.dbContainerName, 'SIGKILL');
    const killedAt = Date.now();

    const writeResult = await writePromise;
    if (writeResult) {
      console.log(`  → In-flight write completed with status ${writeResult.status} before kill`);
    } else {
      console.log('  → In-flight write was terminated (expected)');
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));

    console.log('  → Starting database container (simulating server power-on)...');
    dockerStart(config.dbContainerName);

    // DB should run crash recovery (WAL replay) and come back clean
    const recovered = await platformHealthy(120_000);
    expect(recovered, 'platform healthy within 2 minutes of DB restart after power loss').toBe(
      true,
    );
    const recoveryMs = Date.now() - killedAt;
    console.log(`  → Platform recovered in ${recoveryMs}ms`);
    expect(recoveryMs).toBeLessThan(300_000); // < 5 minutes for major failure

    // Verify data integrity after crash recovery
    const corrupted = await checkDataCorruption(wsId!, token!);
    expect(corrupted, 'no data corruption after power loss').toBe(false);

    const chain = await verifyAuditChainIntegrity(wsId!, token!);
    expect(chain.valid, 'audit chain intact after power loss and WAL recovery').toBe(true);

    console.log('  ✓ Database recovered cleanly after power loss simulation');
  }, 300_000);
});
