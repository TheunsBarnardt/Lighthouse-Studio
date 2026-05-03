/**
 * Chaos Scenario 11: Concurrent migrations
 *
 * Triggers two migration runs simultaneously (operator error / bug).
 * Verifies: advisory locking prevents corruption; second run waits or fails safely.
 */

import pg from 'pg';
import { describe, expect, it } from 'vitest';

import { chaosEnabled, config, requireChaosEnv } from './helpers.js';

const MIGRATION_LOCK_ID = 1234567890; // Must match the platform's migration runner lock ID

describe('Chaos: Concurrent migrations', () => {
  it('advisory locking prevents concurrent migration corruption', async () => {
    if (!chaosEnabled) return;
    requireChaosEnv();

    const pool = new pg.Pool({ connectionString: config.dbUrl });
    const client1 = await pool.connect();
    const client2 = await pool.connect();

    console.log('  → Acquiring advisory lock (simulating migration run 1)...');
    const lock1 = await client1.query(`SELECT pg_try_advisory_lock($1) AS acquired`, [
      MIGRATION_LOCK_ID,
    ]);
    const acquired1 = (lock1.rows[0] as { acquired: boolean }).acquired;
    console.log(`  → Migration run 1 lock acquired: ${acquired1}`);
    expect(acquired1, 'first migration run should acquire the lock').toBe(true);

    // Concurrent migration run should NOT be able to acquire the lock
    console.log('  → Attempting concurrent migration run (run 2)...');
    const lock2 = await client2.query(`SELECT pg_try_advisory_lock($1) AS acquired`, [
      MIGRATION_LOCK_ID,
    ]);
    const acquired2 = (lock2.rows[0] as { acquired: boolean }).acquired;
    console.log(`  → Migration run 2 lock acquired: ${acquired2} (expected: false)`);
    expect(
      acquired2,
      'concurrent migration run must NOT acquire the lock while run 1 holds it',
    ).toBe(false);

    // Release the first lock
    await client1.query(`SELECT pg_advisory_unlock($1)`, [MIGRATION_LOCK_ID]);
    console.log('  → Migration run 1 completed; lock released');

    // Now run 2 should be able to acquire the lock
    const lock2retry = await client2.query(`SELECT pg_try_advisory_lock($1) AS acquired`, [
      MIGRATION_LOCK_ID,
    ]);
    const acquired2retry = (lock2retry.rows[0] as { acquired: boolean }).acquired;
    expect(acquired2retry, 'migration run 2 should acquire lock after run 1 releases').toBe(true);

    // Cleanup
    await client2.query(`SELECT pg_advisory_unlock($1)`, [MIGRATION_LOCK_ID]);
    client1.release();
    client2.release();
    await pool.end();

    console.log('  ✓ Advisory locking prevents concurrent migration corruption');
  }, 30_000);
});
