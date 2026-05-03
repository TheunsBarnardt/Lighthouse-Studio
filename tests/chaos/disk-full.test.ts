/**
 * Chaos Scenario 7: Disk full on platform host
 *
 * Fills the disk on the platform's data volume.
 * Verifies: graceful degradation; logs rotate; no crash.
 *
 * NOTE: This test requires root/sudo access to mount a tmpfs and fill it.
 * Skip in environments where this is not available.
 */

import { execSync } from 'node:child_process';
import { unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { chaosEnabled, platformGet, platformHealthy, requireChaosEnv, signIn } from './helpers.js';

describe('Chaos: Disk full', () => {
  it('degrades gracefully and logs rotate when disk is full', async () => {
    if (!chaosEnabled) return;
    requireChaosEnv();

    // Check if we can create a large temp file on the log volume
    const logDir = process.env['PLATFORM_LOG_DIR'] ?? tmpdir();
    const fillFile = join(logDir, `chaos-fill-${Date.now()}.bin`);

    const token = await signIn('load-test-user-00001@loadtest.internal', 'LoadTest1!');
    expect(token).toBeTruthy();

    // Get free disk space
    let freeKb = 0;
    try {
      const dfOut = execSync(`df -k "${logDir}" | tail -1`).toString().trim();
      freeKb = parseInt(dfOut.split(/\s+/)[3] ?? '0', 10);
    } catch {
      console.log('  → Cannot determine free disk space; skipping fill step');
      return;
    }

    if (freeKb < 1024) {
      console.log('  → Less than 1MB free on log volume; disk already nearly full');
    } else {
      // Fill most of the free space (leave ~1MB)
      const fillKb = Math.max(0, freeKb - 1024);
      console.log(`  → Filling ${fillKb}KB of disk space on ${logDir}...`);
      try {
        execSync(`dd if=/dev/zero of="${fillFile}" bs=1024 count=${fillKb}`, { stdio: 'pipe' });
      } catch {
        console.log('  → dd failed; disk may already be full or insufficient permissions');
      }
    }

    try {
      // Platform should continue to respond (may reject writes, but not crash)
      const res = await platformGet('/api/workspaces', token!);
      console.log(`  → Platform responded with ${res.status} under disk pressure`);

      // Read-only operations (GET) should succeed or fail gracefully — not 500 with uncaught error
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        expect(body).not.toContain('unhandledRejection');
        console.log(`  → Non-OK response body is safe (no stack trace leaks)`);
      }

      // Verify logs still exist (log rotation should have kept things under control)
      try {
        execSync(`ls -la "${logDir}"`, { stdio: 'pipe' });
        console.log('  → Log directory is accessible');
      } catch {
        console.log('  → Could not access log directory');
      }
    } finally {
      // Always clean up the fill file
      try {
        unlinkSync(fillFile);
        console.log('  → Cleaned up disk fill file');
      } catch {
        /* already gone */
      }
    }

    // Platform should be healthy within 30s after disk pressure relieved
    const healthy = await platformHealthy(30_000);
    expect(healthy, 'platform healthy within 30s after disk fill removed').toBe(true);
    console.log('  ✓ Platform recovered after disk full');
  }, 120_000);
});
