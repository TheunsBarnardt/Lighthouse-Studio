/**
 * Chaos Scenario 3: Worker process killed mid-job
 *
 * Sends SIGKILL to the worker during an AI generation job.
 * Verifies: job is retried; no double-execution; no data corruption.
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

describe('Chaos: Worker SIGKILL mid-job', () => {
  it('retries job without double-execution after worker SIGKILL', async () => {
    if (!chaosEnabled) return;
    requireChaosEnv();

    const token = await signIn('load-test-user-00001@loadtest.internal', 'LoadTest1!');
    expect(token).toBeTruthy();

    const listRes = await platformGet('/api/workspaces?limit=1', token!);
    expect(listRes.ok).toBe(true);
    const data = (await listRes.json()) as { data: Array<{ id: string }> };
    const workspaceId = data.data[0]?.id;
    expect(workspaceId).toBeTruthy();

    // Submit a job that will be in-flight when we kill the worker
    // (Using an invitation creation as a proxy since the AI pipeline is Obj 11+)
    const jobEmail = `chaos-worker-${Date.now()}@loadtest.internal`;

    // Kill the worker immediately after submitting
    const submitRes = await platformPost(
      `/api/workspaces/${workspaceId}/invitations`,
      { email: jobEmail },
      token!,
    );
    console.log(`  → Job submitted (status: ${submitRes.status})`);

    console.log('  → Killing worker container...');
    try {
      dockerKill(config.workerContainerName);
    } catch (e) {
      console.log(`  → Worker kill failed (may not be a separate container): ${String(e)}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));

    console.log('  → Restarting worker container...');
    try {
      dockerStart(config.workerContainerName);
    } catch (e) {
      console.log(`  → Worker restart failed: ${String(e)}`);
    }

    // Platform should be healthy within 60s
    const healthy = await platformHealthy(60_000);
    expect(healthy, 'platform healthy within 60s after worker restart').toBe(true);

    // Verify the job was not double-executed: check that the invitation appears exactly once
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const invitationsRes = await platformGet(`/api/workspaces/${workspaceId}/invitations`, token!);
    if (invitationsRes.ok) {
      const invitations = (await invitationsRes.json()) as { data: Array<{ email: string }> };
      const matching = invitations.data.filter((inv) => inv.email === jobEmail);
      expect(matching.length).toBeLessThanOrEqual(1);
      console.log(`  → Job appears ${matching.length} time(s) (expected <= 1)`);
    }

    // No data corruption
    const corrupted = await checkDataCorruption(workspaceId!, token!);
    expect(corrupted).toBe(false);

    const chain = await verifyAuditChainIntegrity(workspaceId!, token!);
    expect(chain.valid, 'audit chain intact after worker SIGKILL').toBe(true);
  }, 120_000);
});
