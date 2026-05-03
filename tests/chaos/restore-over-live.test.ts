/**
 * Chaos Scenario 13: Restore over running database
 *
 * Simulates the operator mistake of restoring a backup on top of a live database.
 * Verifies: the restore script detects this and refuses, with a clear error.
 *
 * This is a safety-rail test. The restore script should never proceed
 * if the target database has active connections or recent write activity.
 */

import { execSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

import { chaosEnabled, config, platformGet, requireChaosEnv, signIn } from './helpers.js';

describe('Chaos: Restore over running database', () => {
  it('restore script refuses to run against a live database', async () => {
    if (!chaosEnabled) return;
    requireChaosEnv();

    const restoreScript = process.env['CHAOS_RESTORE_SCRIPT'] ?? './scripts/restore.sh';

    // Check if restore script exists
    try {
      execSync(`test -f "${restoreScript}"`, { stdio: 'pipe' });
    } catch {
      console.log(`  → Restore script not found at ${restoreScript}`);
      console.log('  → Manual test steps:');
      console.log(
        '     1. While platform is running, attempt: ./scripts/restore.sh --target=staging',
      );
      console.log('     2. Verify: script refuses with a clear "database is live" error');
      console.log('     3. Verify: platform is still running and unaffected');
      console.log('     4. Confirm: the runbook documents this safety check explicitly');
      return;
    }

    // Verify platform is running (there is a live database)
    const token = await signIn('load-test-user-00001@loadtest.internal', 'LoadTest1!');
    expect(token, 'platform should be live before restore attempt').toBeTruthy();

    const healthRes = await platformGet('/health');
    expect(healthRes.ok, 'platform health check passes before restore attempt').toBe(true);

    // Attempt restore against the live database — must be rejected
    console.log('  → Attempting restore against live database (should be rejected)...');
    let restoreOutput = '';
    let restoreExitCode = 0;

    try {
      restoreOutput = execSync(
        `${restoreScript} --dry-run --target=${config.dbContainerName} 2>&1`,
        { stdio: 'pipe', timeout: 30_000 },
      ).toString();
      restoreExitCode = 0;
    } catch (e) {
      const err = e as { status?: number; stdout?: Buffer; stderr?: Buffer };
      restoreExitCode = err.status ?? 1;
      restoreOutput = (err.stdout?.toString() ?? '') + (err.stderr?.toString() ?? '');
    }

    console.log(`  → Restore script exited with code ${restoreExitCode}`);
    console.log(`  → Output: ${restoreOutput.slice(0, 300)}`);

    // The restore script MUST refuse when the database is live
    expect(restoreExitCode, 'restore script must exit non-zero when database is live').not.toBe(0);

    const refusedClearly =
      restoreOutput.toLowerCase().includes('live') ||
      restoreOutput.toLowerCase().includes('running') ||
      restoreOutput.toLowerCase().includes('active') ||
      restoreOutput.toLowerCase().includes('refuse') ||
      restoreOutput.toLowerCase().includes('abort') ||
      restoreOutput.toLowerCase().includes('danger');
    expect(refusedClearly, 'restore script must emit a clear "database is live" message').toBe(
      true,
    );

    // Platform must still be running after the failed restore attempt
    const stillHealthy = await platformGet('/health');
    expect(stillHealthy.ok, 'platform unaffected by refused restore attempt').toBe(true);

    console.log('  ✓ Restore script correctly refused to run against live database');
  }, 60_000);
});
