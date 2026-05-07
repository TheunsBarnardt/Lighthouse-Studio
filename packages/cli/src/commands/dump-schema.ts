import type { Command } from 'commander';

import { writeFileSync } from 'fs';
import pc from 'picocolors';

import { requireConfig } from '../config.js';

export function registerDumpSchema(program: Command): void {
  program
    .command('dump-schema')
    .description('Dump the workspace schema as JSON or YAML')
    .requiredOption('--workspace <slug>', 'Workspace slug')
    .option('--schema <slug>', 'Schema slug (default: main)', 'main')
    .option('--format <format>', 'Output format: json | yaml (default: json)', 'json')
    .option('--out <path>', 'Output file path (default: stdout)')
    .action(async (opts: { workspace: string; schema: string; format: string; out?: string }) => {
      const cfg = requireConfig();

      const res = await fetch(`${cfg.url}/api/v1/schemas/${opts.workspace}/${opts.schema}`, {
        headers: { Authorization: `Bearer ${cfg.token}` },
      });

      if (!res.ok) {
        console.error(pc.red(`Failed to fetch schema: ${res.status} ${res.statusText}`));
        process.exit(1);
      }

      const schema = await res.json();
      let output: string;

      if (opts.format === 'yaml') {
        // Minimal YAML serialization — for production use js-yaml
        output = jsonToYaml(schema);
      } else {
        output = JSON.stringify(schema, null, 2);
      }

      if (opts.out) {
        writeFileSync(opts.out, output + '\n', 'utf8');
        console.log(pc.green('✓') + ` Schema written to ${pc.cyan(opts.out)}`);
      } else {
        process.stdout.write(output + '\n');
      }
    });
}

function jsonToYaml(value: unknown, indent = 0): string {
  const pad = '  '.repeat(indent);
  if (value === null) return 'null';
  if (typeof value === 'string') return `"${value.replace(/"/g, '\\"')}"`;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    return value.map((v) => `${pad}- ${jsonToYaml(v, indent + 1)}`).join('\n');
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return '{}';
    return entries
      .map(([k, v]) => {
        const scalar = typeof v !== 'object' || v === null;
        return scalar
          ? `${pad}${k}: ${jsonToYaml(v, indent + 1)}`
          : `${pad}${k}:\n${jsonToYaml(v, indent + 1)}`;
      })
      .join('\n');
  }
  return String(value);
}
