#!/usr/bin/env node

import { Command } from 'commander';

import { buildDbTargets } from './db-factory.js';
import { readEnv } from './env.js';
import { runVersionCommand } from './commands/version.js';
import { runUpgradeCommand } from './commands/upgrade.js';

const program = new Command();

program
  .name('platform')
  .description('Platform upgrade and version management CLI')
  .version('0.0.0');

// ── platform version ─────────────────────────────────────────────────────────

program
  .command('version')
  .description('Print the current code version and the recorded version on each database')
  .action(async () => {
    const env = readEnv();
    const connections = await buildDbTargets(env);
    try {
      await runVersionCommand(connections);
    } finally {
      await connections.shutdown();
    }
  });

// ── platform upgrade ─────────────────────────────────────────────────────────

program
  .command('upgrade')
  .description('Upgrade the platform to the current code version')
  .option('--dry-run', 'Simulate the upgrade without making changes', false)
  .option(
    '--allow-breaking',
    'Allow breaking migrations (implies a maintenance window)',
    false,
  )
  .option(
    '--skip-backup-check',
    'Skip the recent-backup pre-flight check (emits audit warning)',
    false,
  )
  .option('--rollback', 'Roll back one step to the previous recorded version', false)
  .option('--status', 'Show the last recorded upgrade status per database', false)
  .option('--applied-by <user>', 'User ID or email to record as the upgrade operator')
  .action(async (opts: {
    dryRun: boolean;
    allowBreaking: boolean;
    skipBackupCheck: boolean;
    rollback: boolean;
    status: boolean;
    appliedBy?: string;
  }) => {
    const env = readEnv();
    const connections = await buildDbTargets(env);
    try {
      await runUpgradeCommand(connections, opts);
    } finally {
      await connections.shutdown();
    }
  });

program.parseAsync(process.argv).catch((e: unknown) => {
  process.stderr.write((e instanceof Error ? e.message : String(e)) + '\n');
  process.exit(1);
});
