#!/usr/bin/env tsx
/**
 * CI check: heuristic PII registry coverage for the current branch's diff
 * against a base ref (default: origin/main).
 *
 * For each changed TypeScript and SQL migration file, it looks for column/field
 * names that match common PII patterns (email, phone, address, name, birth,
 * ssn, passport, etc.). If any matches are found and
 * packages/core/src/compliance/personal-data-registry.ts was NOT changed in
 * the same diff, it emits a warning report.
 *
 * This is a SOFT gate — the script never exits non-zero. It surfaces signal
 * for PR review so reviewers can confirm whether new PII fields have been
 * registered. See Objective 7 §compliance.
 *
 * Run via: pnpm pii:check
 *
 * Configuration:
 *   BASE_REF (env): git ref to diff against. Default: origin/main.
 */

import { execSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';

const BASE_REF = process.env['BASE_REF'] ?? 'origin/main';
const REGISTRY_PATH = 'packages/core/src/compliance/personal-data-registry.ts';

const PII_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: 'email', pattern: /\bemail\b/i },
  { name: 'phone / mobile', pattern: /\b(?:phone|mobile|cell|telephone)\b/i },
  { name: 'address', pattern: /\b(?:address|street|city|postcode|zip_code|postal)\b/i },
  {
    name: 'name (first/last/full)',
    pattern: /\b(?:first_name|last_name|full_name|display_name|given_name|family_name)\b/i,
  },
  { name: 'date of birth', pattern: /\b(?:date_of_birth|dob|birth_date|birthdate)\b/i },
  {
    name: 'national ID / SSN',
    pattern: /\b(?:ssn|national_id|tax_id|id_number|passport|passport_number)\b/i,
  },
  { name: 'IP address', pattern: /\bip_address\b/i },
  { name: 'location / GPS', pattern: /\b(?:latitude|longitude|gps|geolocation|geo_point)\b/i },
  { name: 'avatar / photo', pattern: /\b(?:avatar|photo|profile_picture|profile_image)\b/i },
];

function git(args: string): string {
  try {
    return execSync(`git ${args}`, { encoding: 'utf8' });
  } catch {
    return '';
  }
}

function changedFiles(): string[] {
  const out = git(`diff --name-only ${BASE_REF}...HEAD -- "*.ts" "*.tsx" "*.mts" "*.cts" "*.sql"`);
  return out
    .trim()
    .split('\n')
    .filter(Boolean)
    .filter((f) => !f.includes('/node_modules/'))
    .filter((f) => !/\.(test|spec)\.(ts|tsx|mts|cts)$/.test(f));
}

function getAddedLines(file: string): string[] {
  const diff = git(`diff --unified=0 ${BASE_REF}...HEAD -- "${file}"`);
  return diff
    .split('\n')
    .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
    .map((line) => line.slice(1));
}

interface PiiHit {
  file: string;
  patternName: string;
  lines: string[];
}

const changedFilePaths = changedFiles();
const registryChanged = changedFilePaths.includes(REGISTRY_PATH);
const piiHits: PiiHit[] = [];

for (const file of changedFilePaths) {
  if (file === REGISTRY_PATH) continue;
  const addedLines = getAddedLines(file);
  for (const { name, pattern } of PII_PATTERNS) {
    const matches = addedLines.filter((l) => pattern.test(l));
    if (matches.length > 0) {
      piiHits.push({ file, patternName: name, lines: matches.slice(0, 3) });
    }
  }
}

let report = '# PII registry coverage check\n\n';
report += `Diff scanned: \`${BASE_REF}...HEAD\`\n\n`;

if (piiHits.length === 0) {
  report += 'No PII-pattern fields detected in changed files.\n';
} else {
  const uniqueFiles = [...new Set(piiHits.map((h) => h.file))];

  if (registryChanged) {
    report += `**Registry updated in this diff.** ${String(piiHits.length)} PII-pattern hit(s) found across ${String(uniqueFiles.length)} file(s) — confirm the registry entries cover the new fields.\n\n`;
  } else {
    report += `> ⚠️ **${String(piiHits.length)} PII-pattern hit(s) found but \`personal-data-registry.ts\` was NOT changed in this diff.**\n`;
    report +=
      '> If these fields store personal data, add entries to the registry in the same PR. If they do not (e.g. they are query parameters that reference but do not store PII), this warning can be dismissed.\n\n';
  }

  report += '## Detected PII-pattern fields\n\n';
  report += '| File | Pattern | Sample lines |\n|---|---|---|\n';
  for (const hit of piiHits) {
    const sample = hit.lines.map((l) => `\`${l.trim().slice(0, 80)}\``).join('<br>');
    report += `| \`${hit.file}\` | ${hit.patternName} | ${sample} |\n`;
  }
}

report +=
  '\n_This is a heuristic report based on regex pattern matching. It surfaces signal for PR review; it does not block the merge. See `packages/core/src/compliance/personal-data-registry.ts` for the authoritative registry._\n';

process.stdout.write(`${report}\n`);

const summaryPath = process.env['GITHUB_STEP_SUMMARY'];
if (summaryPath) {
  appendFileSync(summaryPath, report);
}

process.exit(0);
