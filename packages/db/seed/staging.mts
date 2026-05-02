#!/usr/bin/env tsx
/**
 * Staging seed script. Populates staging with anonymized realistic data.
 * Idempotent — safe to run multiple times.
 *
 * Full implementation in Objective 4.
 * Requires APP_ENV=staging.
 */

const appEnv = process.env['APP_ENV'] ?? 'development';

if (appEnv !== 'staging') {
  process.stderr.write(
    `❌  seed:staging may only run against APP_ENV=staging. Current: "${appEnv}"\n`,
  );
  process.exit(1);
}

process.stdout.write('▶  seed:staging — stub (full implementation in Objective 4)\n');
process.exit(0);
