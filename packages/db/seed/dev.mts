#!/usr/bin/env tsx
/**
 * Dev seed script. Populates dev with realistic fixtures:
 * workspace, members, projects, sample artifacts.
 * Idempotent — safe to run multiple times.
 *
 * Full implementation in Objective 4 (database adapters + seed data).
 * Requires APP_ENV=development.
 */

const appEnv = process.env['APP_ENV'] ?? 'development';

if (appEnv !== 'development') {
  process.stderr.write(
    `❌  seed:dev may only run against APP_ENV=development. Current: "${appEnv}"\n`,
  );
  process.exit(1);
}

process.stdout.write('▶  seed:dev — stub (full implementation in Objective 4)\n');
process.exit(0);
