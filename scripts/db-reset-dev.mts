#!/usr/bin/env tsx
/**
 * Resets the dev database: drops all data, re-runs migrations, re-seeds.
 * ONLY works for APP_ENV=development. Requires explicit confirmation.
 * Full implementation lands in Objective 4 (database adapters).
 */

import { createInterface } from 'readline';

function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

const appEnv = process.env['APP_ENV'] ?? 'development';

if (appEnv !== 'development') {
  process.stderr.write(
    `\n❌  db:reset:dev may only run against APP_ENV=development.\n` +
      `    Current APP_ENV is "${appEnv}". Aborting.\n\n`,
  );
  process.exit(1);
}

process.stdout.write('\n⚠️  This will WIPE the dev database and re-seed it from scratch.\n');
process.stdout.write('   All existing dev data will be permanently deleted.\n\n');

const answer = await prompt('Type "reset" to confirm: ');

if (answer !== 'reset') {
  process.stdout.write('\nAborted — database was not modified.\n\n');
  process.exit(0);
}

process.stdout.write('\n');
process.stdout.write('▶  db:reset:dev — full implementation in Objective 4\n');
process.stdout.write('   (will drop schema, run migrations, run seed:dev)\n\n');
process.exit(0);
