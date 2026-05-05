#!/usr/bin/env tsx
/**
 * CI check: audit event catalog completeness.
 *
 * Scans the entire codebase for `audit.write(` call sites and extracts the
 * `eventType` string literal. For every event type found in source, checks
 * that it is registered in `REGISTERED_AUDIT_EVENT_TYPES` from
 * `packages/core/src/compliance/audit-events.ts`.
 *
 * This is a HARD gate — the script exits non-zero if any unregistered event
 * types are found. Add new event types to AUDIT_EVENTS before using them.
 *
 * Run via: pnpm audit:catalog
 *
 * Limitations:
 *   - Only detects string literals (not computed expressions). Dynamic event
 *     types that aren't string literals will not be flagged; code review must
 *     catch those.
 *   - Skips test files (*.test.ts, *.spec.ts).
 */

import { execSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const REGISTRY_FILE = resolve('packages/core/src/compliance/audit-events.ts');

// ── Load registered event types ───────────────────────────────────────────────

function loadRegisteredTypes(): Set<string> {
  let src: string;
  try {
    src = readFileSync(REGISTRY_FILE, 'utf8');
  } catch {
    process.stderr.write(`ERROR: Cannot read audit-events.ts at ${REGISTRY_FILE}\n`);
    process.exit(1);
  }

  // Extract all string literal values from the AUDIT_EVENTS const object.
  // Matches patterns like: SOME_KEY: 'some.event.type',
  const registered = new Set<string>();
  const valueRe = /:\s*'([a-z][a-z0-9._]*)'/g;
  let m: RegExpExecArray | null;
  while ((m = valueRe.exec(src)) !== null) {
    registered.add(m[1]);
  }
  return registered;
}

// ── Grep for audit.write call sites ──────────────────────────────────────────

interface AuditCallSite {
  file: string;
  line: number;
  eventType: string;
}

function findAuditWriteCalls(): AuditCallSite[] {
  let raw: string;
  try {
    // Grep for eventType string literals in audit.write blocks.
    // We look for lines containing `eventType:` near a string literal.
    raw = execSync(
      `grep -rn --include="*.ts" --include="*.tsx" --include="*.mts" --include="*.cts" ` +
        `--exclude-dir=node_modules --exclude-dir=dist ` +
        `-E "eventType\\s*:\\s*'[a-z][a-z0-9._]*'" .`,
      { encoding: 'utf8' },
    );
  } catch (err: unknown) {
    // grep exits 1 when no matches found — that's fine
    if (
      typeof err === 'object' &&
      err !== null &&
      'status' in err &&
      (err as { status: number }).status === 1
    ) {
      return [];
    }
    throw err;
  }

  const results: AuditCallSite[] = [];
  const lineRe = /^(.+?):(\d+):\s*.*eventType\s*:\s*'([a-z][a-z0-9._]*)'/;

  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    const m = lineRe.exec(line);
    if (!m) continue;
    const [, file, lineNum, eventType] = m;
    if (!file || !lineNum || !eventType) continue;

    // Skip test files
    if (/\.(test|spec)\.(ts|tsx|mts|cts)$/.test(file)) continue;

    results.push({
      file: file.replace(/^\.\//u, ''),
      line: parseInt(lineNum, 10),
      eventType,
    });
  }

  return results;
}

// ── Main ──────────────────────────────────────────────────────────────────────

const registered = loadRegisteredTypes();
const callSites = findAuditWriteCalls();

const unregistered = callSites.filter((s) => !registered.has(s.eventType));
const unique = [...new Set(callSites.map((s) => s.eventType))];

let report = '# Audit event catalog check\n\n';
report += `Registered event types: **${String(registered.size)}**\n`;
report += `Unique event types found in code: **${String(unique.length)}**\n`;
report += `Call sites scanned: **${String(callSites.length)}**\n\n`;

if (unregistered.length === 0) {
  report += '**All audit event types are registered.** \n';
} else {
  report += `**${String(unregistered.length)} unregistered event type(s) found:**\n\n`;
  report += '| Event type | File | Line |\n|---|---|---:|\n';
  for (const s of unregistered) {
    report += `| \`${s.eventType}\` | \`${s.file}\` | ${String(s.line)} |\n`;
  }
  report +=
    '\nAdd the missing event types to `packages/core/src/compliance/audit-events.ts` before merging.\n';
}

process.stdout.write(`${report}\n`);

const summaryPath = process.env['GITHUB_STEP_SUMMARY'];
if (summaryPath) {
  appendFileSync(summaryPath, report);
}

if (unregistered.length > 0) {
  process.exit(1);
}

process.exit(0);
