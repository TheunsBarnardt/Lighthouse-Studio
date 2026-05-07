#!/usr/bin/env tsx
/**
 * Validates release-manifest.json against release-manifest.schema.json.
 * Exits 0 if valid, 1 with error details if not.
 * Run via: pnpm manifest:validate
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const manifestPath = resolve(root, 'release-manifest.json');
const schemaPath = resolve(root, 'release-manifest.schema.json');

const log = console.log.bind(console);

const error = console.error.bind(console);

function loadJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as unknown;
  } catch (e) {
    error(`Failed to read ${path}: ${String(e)}`);
    process.exit(1);
  }
}

const manifest = loadJson(manifestPath) as Record<string, unknown>;
const schema = loadJson(schemaPath) as {
  required: string[];
  properties: Record<string, { type?: string; minimum?: number; pattern?: string }>;
};

const errors: string[] = [];

// Check required fields
for (const field of schema.required) {
  if (!(field in manifest)) {
    errors.push(`Missing required field: "${field}"`);
  }
}

// Check types for present fields
const props = schema.properties;
for (const [key, def] of Object.entries(props)) {
  if (!(key in manifest)) continue;
  const val = manifest[key];
  if (def.type === 'string' && typeof val !== 'string') {
    errors.push(`"${key}" must be a string`);
  } else if (def.type === 'boolean' && typeof val !== 'boolean') {
    errors.push(`"${key}" must be a boolean`);
  } else if (def.type === 'integer' && (typeof val !== 'number' || !Number.isInteger(val))) {
    errors.push(`"${key}" must be an integer`);
  } else if (def.type === 'array' && !Array.isArray(val)) {
    errors.push(`"${key}" must be an array`);
  }
  if (def.type === 'integer' && typeof def.minimum === 'number' && typeof val === 'number') {
    if (val < def.minimum) errors.push(`"${key}" must be >= ${String(def.minimum)}`);
  }
  if (def.pattern && typeof val === 'string') {
    // eslint-disable-next-line security/detect-non-literal-regexp
    if (!new RegExp(def.pattern).test(val)) {
      errors.push(`"${key}" does not match required pattern (${def.pattern})`);
    }
  }
}

if (errors.length > 0) {
  error('release-manifest.json validation failed:');
  for (const e of errors) error(`  ✗ ${e}`);
  process.exit(1);
}

log(`✔ release-manifest.json is valid (version: ${String(manifest['version'])})`);
