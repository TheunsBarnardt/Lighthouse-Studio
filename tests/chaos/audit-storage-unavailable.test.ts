/**
 * Chaos Scenario 5: Audit log writes fail
 *
 * Simulates audit storage unavailability using a toxic proxy on the audit table.
 * Verifies: fail-closed behavior (operations are rejected when audit cannot be written).
 * A fail-open response (operation succeeds without audit) is a security violation.
 */

import pg from 'pg';
import { describe, expect, it } from 'vitest';

import { chaosEnabled, config, platformPost, requireChaosEnv, signIn } from './helpers.js';

describe('Chaos: Audit storage unavailable', () => {
  it('rejects operations (fail-closed) when audit log writes fail', async () => {
    if (!chaosEnabled) return;
    requireChaosEnv();

    const token = await signIn('load-test-user-00001@loadtest.internal', 'LoadTest1!');
    expect(token).toBeTruthy();

    // Get a workspace to target
    const { platformGet } = await import('./helpers.js');
    const listRes = await platformGet('/api/workspaces?limit=1', token!);
    const wsId = ((await listRes.json()) as { data: Array<{ id: string }> }).data[0]?.id;
    expect(wsId).toBeTruthy();

    // Simulate audit unavailability by revoking the app_user's INSERT on audit_log
    const adminPool = new pg.Pool({ connectionString: config.dbUrl });
    console.log('  → Revoking INSERT on audit_log from app_user...');
    try {
      await adminPool.query('REVOKE INSERT ON audit_log FROM app_user');
    } catch (e) {
      console.log(`  → Could not revoke audit permissions (may not be admin): ${String(e)}`);
      console.log('  → Skipping permission-based audit chaos; consider running as DB admin');
      await adminPool.end();
      return;
    }

    // Try to perform a write operation that should emit an audit event
    let operationResult: Response | null = null;
    try {
      operationResult = await platformPost(
        `/api/workspaces/${wsId}/invitations`,
        { email: `audit-chaos-${Date.now()}@loadtest.internal` },
        token!,
      );
    } catch {
      /* expected */
    }

    // Restore permissions immediately
    await adminPool.query('GRANT INSERT ON audit_log TO app_user');
    await adminPool.end();
    console.log('  → Restored audit_log INSERT permission');

    // The operation must have been rejected (fail-closed), not silently succeeded
    if (operationResult) {
      console.log(`  → Operation returned status ${operationResult.status}`);
      expect([500, 503]).toContain(operationResult.status);

      // CRITICAL: if the operation returned 200/201, that's a fail-open security violation
      if (operationResult.ok) {
        throw new Error(
          'SECURITY VIOLATION: Write operation succeeded without audit log being written. ' +
            'The platform is fail-open on audit failures. This must be fixed before passing.',
        );
      }
    } else {
      console.log('  → Operation threw (connection error during audit failure — acceptable)');
    }

    console.log('  ✓ Fail-closed behavior confirmed');
  }, 60_000);
});
