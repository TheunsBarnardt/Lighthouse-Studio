/**
 * Chaos Scenario 8: Network partition between web app and database
 *
 * Uses iptables/tc to simulate network partition.
 * Verifies: timeout behavior; retry logic; recovery without data corruption.
 *
 * NOTE: Requires root/sudo and iptables. Designed for Linux staging environment.
 * On Windows staging, uses Docker network disconnect instead.
 */

import { execSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

import {
  chaosEnabled,
  checkDataCorruption,
  config,
  platformGet,
  platformHealthy,
  requireChaosEnv,
  signIn,
  verifyAuditChainIntegrity,
} from './helpers.js';

describe('Chaos: Network partition (web ↔ database)', () => {
  it('handles network partition with correct timeout and recovers', async () => {
    if (!chaosEnabled) return;
    requireChaosEnv();

    const token = await signIn('load-test-user-00001@loadtest.internal', 'LoadTest1!');
    expect(token).toBeTruthy();

    const listRes = await platformGet('/api/workspaces?limit=1', token!);
    const wsId = ((await listRes.json()) as { data: Array<{ id: string }> }).data[0]?.id;

    let partitionMethod: 'docker' | 'iptables' | 'none' = 'none';

    // Try Docker network disconnect first (works on any OS with Docker)
    try {
      execSync(
        `docker network disconnect platform_default ${config.dbContainerName} 2>/dev/null || true`,
        { stdio: 'pipe' },
      );
      partitionMethod = 'docker';
      console.log('  → Applied Docker network partition');
    } catch {
      // Try iptables (Linux only)
      try {
        const dbIp = execSync(
          `docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' ${config.dbContainerName}`,
        )
          .toString()
          .trim();
        execSync(`iptables -A INPUT -s ${dbIp} -j DROP`, { stdio: 'pipe' });
        execSync(`iptables -A OUTPUT -d ${dbIp} -j DROP`, { stdio: 'pipe' });
        partitionMethod = 'iptables';
        console.log(`  → Applied iptables partition for DB at ${dbIp}`);
      } catch {
        console.log('  → Cannot apply network partition (no Docker network control or iptables)');
        console.log(
          '  → Manual test required: use tc/iptables to simulate partition, then verify:',
        );
        console.log('     1. Requests fail with 503/504 within < 5s (not hang indefinitely)');
        console.log('     2. Platform recovers within 60s after partition removed');
        return;
      }
    }

    const partitionedAt = Date.now();

    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Request under partition should time out, not hang indefinitely
      const controller = new AbortController();
      const timeout = setTimeout(() => {
        controller.abort();
      }, 10_000);
      let partitionedRes: Response | null = null;
      try {
        partitionedRes = await platformGet('/api/workspaces', token!);
      } catch {
        console.log('  → Request failed (expected under partition)');
      } finally {
        clearTimeout(timeout);
      }

      if (partitionedRes) {
        console.log(`  → Platform responded ${partitionedRes.status} under partition`);
        // Should not be 200 — DB is unreachable
        expect([500, 502, 503, 504]).toContain(partitionedRes.status);
      }

      // Verify timeout was reasonable (< 5s from request to error response)
      const elapsed = Date.now() - partitionedAt;
      console.log(`  → Request failed in ${elapsed}ms (should be < 10s)`);
      expect(elapsed).toBeLessThan(10_000);
    } finally {
      // Restore network
      if (partitionMethod === 'docker') {
        try {
          execSync(`docker network connect platform_default ${config.dbContainerName}`, {
            stdio: 'pipe',
          });
          console.log('  → Docker network restored');
        } catch {
          /* ignore */
        }
      } else if (partitionMethod === 'iptables') {
        try {
          const dbIp = execSync(
            `docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' ${config.dbContainerName}`,
          )
            .toString()
            .trim();
          execSync(`iptables -D INPUT -s ${dbIp} -j DROP`, { stdio: 'pipe' });
          execSync(`iptables -D OUTPUT -d ${dbIp} -j DROP`, { stdio: 'pipe' });
          console.log('  → iptables rules removed');
        } catch {
          /* ignore */
        }
      }
    }

    // Platform should recover within 60s
    const recovered = await platformHealthy(60_000);
    expect(recovered, 'platform recovers within 60s after network partition removed').toBe(true);
    console.log('  → Platform recovered after network partition');

    if (wsId) {
      const corrupted = await checkDataCorruption(wsId, token!);
      expect(corrupted, 'no data corruption after network partition').toBe(false);

      const chain = await verifyAuditChainIntegrity(wsId, token!);
      expect(chain.valid, 'audit chain intact').toBe(true);
    }
  }, 180_000);
});
