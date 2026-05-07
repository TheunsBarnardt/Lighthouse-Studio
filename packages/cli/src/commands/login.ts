import type { Command } from 'commander';

import pc from 'picocolors';
import { createInterface } from 'readline';

import { writeConfig } from '../config.js';

function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export function registerLogin(program: Command): void {
  program
    .command('login')
    .description('Authenticate with a Platform installation and store credentials')
    .requiredOption('--url <url>', 'Platform installation URL')
    .option('--token <token>', 'API token (skips interactive prompt)')
    .action(async (opts: { url: string; token?: string }) => {
      const baseUrl = opts.url.replace(/\/$/, '');

      let token = opts.token;
      if (!token) {
        token = await prompt(`Platform API token for ${pc.cyan(baseUrl)}: `);
      }

      // Verify the token by calling /api/v1/auth/me
      try {
        const res = await fetch(`${baseUrl}/api/v1/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          console.error(pc.red(`Authentication failed: ${res.status} ${res.statusText}`));
          process.exit(1);
        }
        const user = (await res.json()) as { email?: string };
        writeConfig({ url: baseUrl, token });
        console.log(pc.green('✓') + ` Logged in${user.email ? ` as ${pc.bold(user.email)}` : ''}`);
      } catch (err) {
        console.error(pc.red('Could not connect to platform: ' + String(err)));
        process.exit(1);
      }
    });
}
