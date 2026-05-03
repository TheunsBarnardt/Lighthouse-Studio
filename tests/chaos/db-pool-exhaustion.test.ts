/**
 * Chaos Scenario 2: Database connection pool exhaustion
 *
 * Holds all pool connections by running long-running transactions.
 * Verifies: graceful degradation (queue or reject), no crash, correct 503 responses.
 */

import pg from 'pg';
import { describe, expect, it } from 'vitest';

import { chaosEnabled, config, platformGet, requireChaosEnv, signIn, waitFor } from './helpers.js';

describe('Chaos: DB connection pool exhaustion', () => {
  it('degrades gracefully when pool is exhausted', async () => {
    if (!chaosEnabled) return;
    requireChaosEnv();

    const token = await signIn('load-test-user-00001@loadtest.internal', 'LoadTest1!');
    expect(token).toBeTruthy();

    // Hold as many connections as the pool allows (plus a few more)
    const holderPool = new pg.Pool({ connectionString: config.dbUrl, max: 50 });
    const heldClients: pg.PoolClient[] = [];

    console.log('  → Exhausting connection pool...');
    try {
      for (let i = 0; i < 50; i++) {
        try {
          const c = await holderPool.connect();
          await c.query('BEGIN');
          // Hold with an idle transaction
          heldClients.push(c);
        } catch {
          break; // pool exhausted at the DB level
        }
      }
      console.log(`  → Held ${heldClients.length} connections`);

      // Platform requests should now be queued or rejected — not crash
      const res = await platformGet('/api/workspaces', token!);
      console.log(`  → Platform responded with ${res.status} under pool exhaustion`);

      // 503 (service unavailable) or 200 (if platform has its own pool with headroom) are both acceptable.
      // What is NOT acceptable: 500 with unhandled exception visible in response.
      expect([200, 503, 504]).toContain(res.status);

      if (res.status >= 500) {
        const body = await res.text();
        expect(body).not.toContain('unhandledRejection');
        expect(body).not.toContain('stack trace');
      }
    } finally {
      // Release all held connections — restores pool
      for (const c of heldClients) {
        try {
          await c.query('ROLLBACK');
          c.release();
        } catch {
          /* ignore */
        }
      }
      await holderPool.end();
      console.log('  → Released all held connections');
    }

    // Platform should return to normal within 30s
    const recovered = await waitFor(async () => {
      const r = await platformGet('/api/workspaces', token!);
      return r.ok;
    }, 30_000);
    expect(recovered, 'platform should recover within 30s after pool release').toBe(true);
    console.log('  → Platform recovered after pool release');
  }, 120_000);
});
