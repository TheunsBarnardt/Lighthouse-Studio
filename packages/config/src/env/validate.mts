#!/usr/bin/env tsx
/**
 * Standalone env validation script.
 * Called by scripts/setup-local.mts to validate .env.local before development starts.
 * Exits 0 if valid, 1 with error details if invalid.
 */

import { config } from 'dotenv';
import { join, resolve } from 'path';

const envFile =
  process.env['LOAD_ENV_FROM'] ?? join(resolve(import.meta.dirname, '../../../../'), '.env.local');

config({ path: envFile, override: true });

const { serverEnvSchema } = await import('./schema.js');

const result = serverEnvSchema.safeParse(process.env);

if (!result.success) {
  const errors = result.error.flatten();
  const lines: string[] = ['', '   ❌  Environment validation failed:', ''];

  const fieldErrors = errors.fieldErrors as Record<string, string[] | undefined>;
  for (const [field, messages] of Object.entries(fieldErrors)) {
    if (messages && messages.length > 0) {
      process.stdout.write(`      ${field}: ${messages.join(', ')}\n`);
    }
  }

  if (errors.formErrors.length > 0) {
    lines.push('', '      Cross-field errors:');
    for (const msg of errors.formErrors) {
      lines.push(`        • ${msg}`);
    }
  }

  lines.push('');
  process.stdout.write(lines.join('\n'));
  process.exit(1);
}

process.stdout.write('   ✓  Environment variables are valid\n');
process.exit(0);
