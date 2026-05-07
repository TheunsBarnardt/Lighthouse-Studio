import type { Command } from 'commander';

import pc from 'picocolors';

import { requireConfig } from '../config.js';

export function registerWatch(program: Command): void {
  program
    .command('watch')
    .description('Watch for schema changes and automatically re-sync types')
    .requiredOption('--workspace <slug>', 'Workspace slug')
    .option('--schema <slug>', 'Schema slug (default: main)', 'main')
    .option('--out <path>', 'Output file path', '.platform/types.ts')
    .option('--interval <ms>', 'Polling interval in milliseconds (default: 5000)', '5000')
    .action(async (opts: { workspace: string; schema: string; out: string; interval: string }) => {
      const cfg = requireConfig();
      const intervalMs = parseInt(opts.interval, 10);

      console.log(pc.bold(`Watching workspace ${pc.cyan(opts.workspace)} for schema changes...`));
      console.log('Press Ctrl+C to stop.\n');

      let lastHash: string | null = null;

      async function checkAndSync(): Promise<void> {
        try {
          const res = await fetch(
            `${cfg.url}/api/v1/data/${opts.workspace}/schema-hash?schema=${opts.schema}`,
            { headers: { Authorization: `Bearer ${cfg.token}` } },
          );
          if (!res.ok) return;

          const { hash } = (await res.json()) as { hash: string };
          if (hash !== lastHash) {
            if (lastHash !== null) {
              console.log(pc.yellow('Schema changed. Re-syncing types...'));
            }
            lastHash = hash;

            // Re-run sync-types inline
            const { execSync } = await import('child_process');
            execSync(
              `pdm sync-types --workspace ${opts.workspace} --schema ${opts.schema} --out ${opts.out}`,
              { stdio: 'inherit' },
            );
          }
        } catch {
          // Network errors during watch are transient — keep watching
        }
      }

      await checkAndSync();
      const timer = setInterval(() => {
        void checkAndSync();
      }, intervalMs);

      process.on('SIGINT', () => {
        clearInterval(timer);
        console.log('\n' + pc.gray('Watch stopped.'));
        process.exit(0);
      });
    });
}
