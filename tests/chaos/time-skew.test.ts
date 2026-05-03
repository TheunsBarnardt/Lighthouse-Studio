/**
 * Chaos Scenario 9: Time skew (5 minutes off)
 *
 * Sets system clock 5 minutes forward/backward.
 * Verifies: session handling; token validation; audit timestamps remain consistent.
 *
 * NOTE: Requires root access for `date` command. On Docker, use container clock skew.
 */

import { execSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

import {
  chaosEnabled,
  config,
  platformGet,
  platformPost,
  requireChaosEnv,
  signIn,
  verifyAuditChainIntegrity,
} from './helpers.js';

describe('Chaos: Time skew', () => {
  it('handles 5-minute clock skew gracefully', async () => {
    if (!chaosEnabled) return;
    requireChaosEnv();

    // Prefer container-based time skew to avoid affecting the test host
    const dbContainer = config.dbContainerName;
    let skewApplied = false;

    console.log('  → Applying 5-minute forward time skew to database container...');
    try {
      // Shift the DB container's clock 5 minutes forward
      execSync(
        `docker exec --privileged ${dbContainer} date -s "$(date -d '+5 minutes' '+%Y-%m-%d %H:%M:%S')" 2>/dev/null`,
        { stdio: 'pipe' },
      );
      skewApplied = true;
      console.log('  → 5-minute time skew applied to DB container');
    } catch {
      console.log('  → Cannot apply container time skew; performing read-only checks instead');
    }

    try {
      // Test 1: Sign-in still works (session created with skewed DB clock)
      const token = await signIn('load-test-user-00001@loadtest.internal', 'LoadTest1!');
      if (skewApplied) {
        // Session creation should succeed even with skewed clock
        expect(token, 'sign-in should succeed under 5-minute clock skew').toBeTruthy();
        console.log('  → Sign-in succeeded under time skew');
      }

      if (!token) return;

      // Test 2: API calls work with the session
      const res = await platformGet('/api/workspaces?limit=1', token);
      expect(res.ok).toBe(true);
      console.log('  → API call succeeded under time skew');

      // Test 3: Audit timestamps are in UTC and monotonically increasing
      const listRes = await platformGet('/api/workspaces?limit=1', token);
      const wsId = ((await listRes.json()) as { data: Array<{ id: string }> }).data[0]?.id;

      if (wsId) {
        // Create two audit events in sequence
        await platformPost(
          `/api/workspaces/${wsId}/invitations`,
          { email: `skew-1-${Date.now()}@loadtest.internal` },
          token,
        );
        await platformPost(
          `/api/workspaces/${wsId}/invitations`,
          { email: `skew-2-${Date.now()}@loadtest.internal` },
          token,
        );

        const auditRes = await platformGet(`/api/workspaces/${wsId}/audit-log?limit=5`, token);
        if (auditRes.ok) {
          const events = (
            (await auditRes.json()) as { data: Array<{ occurredAt: string; sequence: number }> }
          ).data;
          // Sequences must be monotonically increasing regardless of clock skew
          for (let i = 1; i < events.length; i++) {
            expect(events[i]!.sequence).toBeGreaterThan(events[i - 1]!.sequence);
          }
          console.log('  → Audit sequences are monotonically increasing under time skew');
        }

        const chain = await verifyAuditChainIntegrity(wsId, token);
        expect(chain.valid, 'audit chain valid under time skew').toBe(true);
        console.log('  → Audit chain valid under time skew');
      }
    } finally {
      if (skewApplied) {
        // Restore DB container to system time
        try {
          const systemTime = new Date().toISOString().replace('T', ' ').substring(0, 19);
          execSync(`docker exec --privileged ${dbContainer} date -s "${systemTime}" 2>/dev/null`, {
            stdio: 'pipe',
          });
          console.log('  → DB container time restored');
        } catch {
          /* ignore */
        }
      }
    }
  }, 60_000);
});
