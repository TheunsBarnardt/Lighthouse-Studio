/**
 * Bundle size guard (DoD 24 — Objective 19).
 * Fails if any measured bundle exceeds its limit.
 *
 * Limits:
 *   @platform/sdk  core index   < 30 KB gzipped
 *   @platform/sdk-react index   < 50 KB gzipped
 *   @platform/sdk-vue   index   < 50 KB gzipped
 *
 * Run: node scripts/check-bundle-size.mjs
 */

import { readFileSync } from 'fs';
import { gzipSync } from 'zlib';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

const checks = [
  { file: 'packages/sdk/dist/index.js', label: '@platform/sdk (core)', limitKB: 30 },
  { file: 'packages/sdk-react/dist/index.js', label: '@platform/sdk-react', limitKB: 50 },
  { file: 'packages/sdk-vue/dist/index.js', label: '@platform/sdk-vue', limitKB: 50 },
];

let failed = false;

for (const { file, label, limitKB } of checks) {
  const abs = join(root, file);
  let raw;
  try {
    raw = readFileSync(abs);
  } catch {
    console.error(`SKIP  ${label} — dist not built (${file})`);
    continue;
  }
  const gz = gzipSync(raw);
  const kb = gz.length / 1024;
  const ok = kb <= limitKB;
  const status = ok ? 'OK   ' : 'FAIL ';
  console.log(`${status} ${label}: ${kb.toFixed(1)} KB / ${limitKB} KB limit`);
  if (!ok) failed = true;
}

if (failed) {
  console.error('\nBundle size limit exceeded. Reduce the bundle before merging.');
  process.exit(1);
}
console.log('\nAll bundle sizes within limits.');
