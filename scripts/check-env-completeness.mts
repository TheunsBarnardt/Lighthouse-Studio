#!/usr/bin/env tsx
/**
 * CI check: verifies that every key in the Zod server schema has a corresponding
 * entry in .env.example (and vice versa). Prevents the schema and example drifting apart.
 *
 * Run via: pnpm env:completeness
 * Also runs in CI on every PR.
 */

import { readFileSync } from 'fs';
import { join, resolve } from 'path';

const ROOT = resolve(import.meta.dirname, '..');

// ---------------------------------------------------------------------------
// Parse .env.example: collect all non-comment variable names
// ---------------------------------------------------------------------------

const exampleContent = readFileSync(join(ROOT, '.env.example'), 'utf8');
const exampleKeys = new Set<string>();

for (const line of exampleContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed) continue;
  // Match both active (KEY=value) and commented-out (# KEY=value) variable lines
  const match = /^(?:#\s*)?([A-Z][A-Z0-9_]*)=/.exec(trimmed);
  if (match?.[1]) {
    exampleKeys.add(match[1]);
  }
}

// ---------------------------------------------------------------------------
// Parse the schema: collect all top-level keys from the composed serverEnvSchema
// and clientEnvSchema using a regex over the source rather than importing at runtime
// (avoids needing a full Node env to run this check in CI).
// ---------------------------------------------------------------------------

const schemaSource = readFileSync(join(ROOT, 'packages/config/src/env/schema.ts'), 'utf8');
const schemaKeys = new Set<string>();

// Capture keys like: SOME_KEY: z.something(...)
for (const match of schemaSource.matchAll(/^\s{2}([A-Z][A-Z0-9_]*):/gm)) {
  if (match[1]) {
    schemaKeys.add(match[1]);
  }
}

// ---------------------------------------------------------------------------
// Compare
// ---------------------------------------------------------------------------

const inSchemaNotExample = [...schemaKeys].filter((k) => !exampleKeys.has(k));
const inExampleNotSchema = [...exampleKeys].filter((k) => !schemaKeys.has(k));

let failed = false;

if (inSchemaNotExample.length > 0) {
  process.stdout.write('\n❌  Keys in schema but missing from .env.example:\n');
  for (const k of inSchemaNotExample) {
    process.stdout.write(`     ${k}\n`);
  }
  failed = true;
}

if (inExampleNotSchema.length > 0) {
  process.stdout.write('\n❌  Keys in .env.example but missing from schema:\n');
  for (const k of inExampleNotSchema) {
    process.stdout.write(`     ${k}\n`);
  }
  failed = true;
}

if (failed) {
  process.stdout.write('\n   Fix: add the missing keys to the appropriate file.\n\n');
  process.exit(1);
}

process.stdout.write(
  `✓  env completeness OK (${String(schemaKeys.size)} schema keys, ${String(exampleKeys.size)} example keys)\n`,
);
process.exit(0);
