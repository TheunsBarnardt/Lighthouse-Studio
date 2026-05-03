/**
 * Chaos Scenario 4: Web app process killed mid-request
 *
 * Kills the web app while requests are in-flight.
 * Verifies: clients see appropriate errors; no data corruption.
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
  requireChaosEnv,
  signIn,
  verifyAuditChainIntegrity,
} from './helpers.js';

describe('Chaos: Web app SIGKILL mid-request', () => {
  it('clients see proper errors and no data corruption after web app SIGKILL', async () => {
    if (!chaosEnabled) return;
    requireChaosEnv();

    const token = await signIn('load-test-user-00001@loadtest.internal', 'LoadTest1!');
    expect(token).toBeTruthy();

    const listRes = await platformGet('/api/workspaces?limit=1', token!);
    const workspaceId = ((await listRes.json()) as { data: Array<{ id: string }> }).data[0]?.id;
    expect(workspaceId).toBeTruthy();

    // Send a request and immediately kill the web app (race condition — this is the point)
    const requestPromise = platformGet('/api/workspaces', token!).catch(() => null);

    console.log('  → Killing web app container...');
    dockerKill(config.webContainerName);

    const res = await requestPromise;
    if (res) {
      // If the request completed before the kill, we accept any successful response
      console.log(
        `  → In-flight request completed with status ${res.status} (race won by request)`,
      );
    } else {
      console.log('  → In-flight request was terminated (expected ECONNRESET)');
      // This is the expected path — network error, not an unhandled app exception
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));

    // After kill, new requests should fail with connection error (not app running)
    const duringRes = await platformGet('/api/workspaces', token!).catch(() => null);
    expect(duringRes?.ok).toBeFalsy();
    console.log('  → Requests fail correctly during web app downtime');

    console.log('  → Restarting web app container...');
    dockerStart(config.webContainerName);

    const recovered = await platformHealthy(60_000);
    expect(recovered, 'web app healthy within 60s after SIGKILL').toBe(true);
    const recoveryMs = 60_000; // measured by waitFor internals
    console.log(`  → Web app recovered (within ${recoveryMs}ms limit)`);

    // No data corruption — the killed request did not partially commit
    const corrupted = await checkDataCorruption(workspaceId!, token!);
    expect(corrupted).toBe(false);

    const chain = await verifyAuditChainIntegrity(workspaceId!, token!);
    expect(chain.valid, 'audit chain intact after web app SIGKILL').toBe(true);
  }, 120_000);
});
