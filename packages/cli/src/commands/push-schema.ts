import type { Command } from 'commander';

import { readFileSync, existsSync } from 'fs';
import pc from 'picocolors';

import { requireConfig } from '../config.js';

export function registerPushSchema(program: Command): void {
  program
    .command('push-schema')
    .description('Push a local schema definition to a workspace (IaC workflow)')
    .requiredOption('--workspace <slug>', 'Workspace slug')
    .option('--schema <slug>', 'Schema slug (default: main)', 'main')
    .option('--file <path>', 'Schema file to push (JSON or YAML)', 'schema.json')
    .option('--dry-run', 'Preview changes without applying them')
    .action(async (opts: { workspace: string; schema: string; file: string; dryRun?: boolean }) => {
      const cfg = requireConfig();

      if (!existsSync(opts.file)) {
        console.error(pc.red(`Schema file not found: ${opts.file}`));
        process.exit(1);
      }

      const raw = readFileSync(opts.file, 'utf8');
      let schema: unknown;
      try {
        schema = JSON.parse(raw);
      } catch {
        console.error(pc.red('Failed to parse schema file. Must be valid JSON.'));
        process.exit(1);
      }

      const url = `${cfg.url}/api/v1/schemas/${opts.workspace}/${opts.schema}`;
      const endpoint = opts.dryRun ? `${url}/diff` : url;

      const res = await fetch(endpoint, {
        method: opts.dryRun ? 'POST' : 'PUT',
        headers: {
          Authorization: `Bearer ${cfg.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(schema),
      });

      if (!res.ok) {
        const body = await res.text();
        console.error(pc.red(`Failed to push schema: ${res.status}\n${body}`));
        process.exit(1);
      }

      const result = (await res.json()) as { changes?: unknown[]; applied?: boolean };

      if (opts.dryRun) {
        const changes = result.changes ?? [];
        console.log(pc.bold('Dry run — changes that would be applied:'));
        console.log(JSON.stringify(changes, null, 2));
        console.log(`\n${pc.yellow(`${changes.length} change(s) pending.`)}`);
      } else {
        console.log(pc.green('✓') + ` Schema pushed to workspace ${pc.cyan(opts.workspace)}`);
      }
    });
}
