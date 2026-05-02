#!/usr/bin/env tsx
/**
 * Prod seed script. ONLY creates structural rows (default roles, system config).
 * Never creates user data. Requires --confirm flag and APP_ENV=production.
 *
 * Full implementation in Objective 4.
 */

const appEnv = process.env['APP_ENV'] ?? 'development';
const hasConfirm = process.argv.includes('--confirm');

if (appEnv !== 'production') {
  process.stderr.write(
    `❌  seed:prod may only run against APP_ENV=production. Current: "${appEnv}"\n`,
  );
  process.exit(1);
}

if (!hasConfirm) {
  process.stderr.write(
    `❌  seed:prod requires the --confirm flag to prevent accidental runs.\n` +
      `    Run with: pnpm seed:prod -- --confirm\n`,
  );
  process.exit(1);
}

process.stdout.write('▶  seed:prod — stub (full implementation in Objective 4)\n');
process.exit(0);
