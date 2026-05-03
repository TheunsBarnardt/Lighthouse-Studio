#!/usr/bin/env tsx
/**
 * CI check: heuristic telemetry coverage report for the current branch's diff
 * against a base ref (default: origin/main).
 *
 * For each changed TypeScript file (excluding tests), it counts:
 *   - new function declarations introduced by the diff
 *   - logged events       (logger.{trace,debug,info,warn,error,fatal})
 *   - tracing calls       (withSpan(...) or tracer.*)
 *   - throw sites         (throw new ...)
 *   - error reporter calls (errorReporter.{report,captureMessage})
 *
 * The output is a markdown report on stdout, also appended to GITHUB_STEP_SUMMARY
 * when running in GitHub Actions. This is a SOFT gate per Objective 3 §5.12 —
 * the script never exits non-zero just because coverage looks low. Reviewers
 * use the numbers to decide whether the change carries enough observability.
 *
 * Run via: pnpm telemetry:coverage
 *
 * Configuration:
 *   BASE_REF (env): git ref to diff against. Default: origin/main.
 */

import { execSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';

const BASE_REF = process.env['BASE_REF'] ?? 'origin/main';

interface FileCounts {
  file: string;
  newFunctions: number;
  loggedEvents: number;
  spans: number;
  throwSites: number;
  errorReports: number;
}

function git(args: string): string {
  try {
    return execSync(`git ${args}`, { encoding: 'utf8' });
  } catch {
    return '';
  }
}

function changedTsFiles(): string[] {
  // Only consider production TS sources; skip tests and node_modules.
  const out = git(`diff --name-only ${BASE_REF}...HEAD -- "*.ts" "*.tsx" "*.mts" "*.cts"`);
  return out
    .trim()
    .split('\n')
    .filter(Boolean)
    .filter((f) => !f.includes('/node_modules/'))
    .filter((f) => !/\.(test|spec)\.(ts|tsx|mts|cts)$/.test(f));
}

function getAddedLines(file: string): string[] {
  // --unified=0 keeps only the added lines without surrounding context.
  const diff = git(`diff --unified=0 ${BASE_REF}...HEAD -- "${file}"`);
  return diff
    .split('\n')
    .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
    .map((line) => line.slice(1));
}

function countMatches(lines: string[], pattern: RegExp): number {
  let n = 0;
  for (const line of lines) {
    const matches = line.match(pattern);
    if (matches) n += matches.length;
  }
  return n;
}

const FN_DECL =
  /(?:export\s+)?(?:async\s+)?function\s+\w+|(?:export\s+)?(?:const|let)\s+\w+\s*[:=]\s*(?:async\s+)?(?:\(|function\b)/g;
const LOGGED_EVENT = /\b(?:logger|log)\.(?:trace|debug|info|warn|error|fatal)\b/g;
const SPAN_CALL = /\bwithSpan\b|\btracer\.[A-Za-z_]/g;
const THROW_SITE = /\bthrow\s+new\b/g;
const ERROR_REPORT = /\berrorReporter\.(?:report|captureMessage)\b/g;

function analyseFile(file: string): FileCounts {
  const added = getAddedLines(file);
  return {
    file,
    newFunctions: countMatches(added, FN_DECL),
    loggedEvents: countMatches(added, LOGGED_EVENT),
    spans: countMatches(added, SPAN_CALL),
    throwSites: countMatches(added, THROW_SITE),
    errorReports: countMatches(added, ERROR_REPORT),
  };
}

const files = changedTsFiles();

let report = '# Telemetry coverage report\n\n';
report += `Diff scanned: \`${BASE_REF}...HEAD\`\n\n`;

if (files.length === 0) {
  report += 'No production TypeScript files changed (tests excluded).\n';
} else {
  const perFile = files.map(analyseFile);
  const totals = perFile.reduce(
    (acc, f) => ({
      newFunctions: acc.newFunctions + f.newFunctions,
      loggedEvents: acc.loggedEvents + f.loggedEvents,
      spans: acc.spans + f.spans,
      throwSites: acc.throwSites + f.throwSites,
      errorReports: acc.errorReports + f.errorReports,
    }),
    { newFunctions: 0, loggedEvents: 0, spans: 0, throwSites: 0, errorReports: 0 },
  );

  report += `${String(files.length)} production TypeScript file(s) changed.\n\n`;
  report += '## Totals\n\n';
  report += '| Signal | Count |\n|---|---:|\n';
  report += `| New function declarations | ${String(totals.newFunctions)} |\n`;
  report += `| Logged events (logger.*) | ${String(totals.loggedEvents)} |\n`;
  report += `| Spans / tracer calls | ${String(totals.spans)} |\n`;
  report += `| Throw sites (\`throw new ...\`) | ${String(totals.throwSites)} |\n`;
  report += `| Error reporter calls | ${String(totals.errorReports)} |\n\n`;

  report += '## Heuristic guidance\n\n';
  if (totals.newFunctions > 0) {
    const logRatio = totals.loggedEvents / totals.newFunctions;
    const spanRatio = totals.spans / totals.newFunctions;
    report += `- Logged events per new function: ${logRatio.toFixed(2)}\n`;
    report += `- Spans per new function: ${spanRatio.toFixed(2)}\n`;
  }
  if (totals.throwSites > totals.errorReports) {
    const gap = totals.throwSites - totals.errorReports;
    report += `- ⚠️ ${String(gap)} throw site(s) without a matching errorReporter call. `;
    report +=
      'Check that unexpected errors flow through `ErrorReporterPort` (expected errors like ValidationError/NotFoundError are filtered automatically and do not need explicit reporting).\n';
  }
  if (totals.newFunctions > 0 && totals.loggedEvents === 0 && totals.spans === 0) {
    report +=
      '- ⚠️ New functions added but no logs or spans introduced. Confirm whether this code path is intentionally silent (e.g., pure mappers, internal helpers).\n';
  }

  report += '\n## Per-file breakdown\n\n';
  report += '| File | Fns | Logs | Spans | Throws | Reports |\n|---|---:|---:|---:|---:|---:|\n';
  for (const f of perFile) {
    report += `| \`${f.file}\` | ${String(f.newFunctions)} | ${String(f.loggedEvents)} | ${String(f.spans)} | ${String(f.throwSites)} | ${String(f.errorReports)} |\n`;
  }
}

report +=
  '\n_This is a heuristic report based on regex matching of added lines. It surfaces signal for PR review; it does not block the merge. See `CONTRIBUTING.md` for the observability checklist._\n';

process.stdout.write(`${report}\n`);

const summaryPath = process.env['GITHUB_STEP_SUMMARY'];
if (summaryPath) {
  appendFileSync(summaryPath, report);
}

process.exit(0);
