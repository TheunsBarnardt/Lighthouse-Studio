#!/usr/bin/env tsx
/**
 * AI reasoning capture gate.
 *
 * Scans packages/core/src/ai/prompts for files that call definePrompt() but whose
 * output schema (outputs: z.object({...})) does not include a `reasoning` field.
 *
 * Exits 0 if all prompt files include reasoning in their output schema.
 * Exits 1 if any prompt files are missing it, printing the offending paths.
 *
 * Run via: pnpm ai:check-reasoning
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const promptsDir = resolve(root, 'packages', 'core', 'src', 'ai', 'prompts');

const log = console.log.bind(console);
const error = console.error.bind(console);

function walkTs(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkTs(full));
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      files.push(full);
    }
  }
  return files;
}

function fileExists(path: string): boolean {
  try {
    return statSync(path).isDirectory() === false || statSync(path).isDirectory();
  } catch {
    return false;
  }
}

if (!fileExists(promptsDir)) {
  log('No prompts directory found at ' + promptsDir + ' — skipping reasoning check.');
  process.exit(0);
}

const promptFiles = walkTs(promptsDir);
const violations: string[] = [];

for (const file of promptFiles) {
  const src = readFileSync(file, 'utf8');

  // Only check files that use definePrompt
  if (!src.includes('definePrompt(')) {
    continue;
  }

  // Check whether the file's output schema (z.object({...})) contains a
  // `reasoning` field. We look for the literal string `reasoning:` inside a
  // z.object block in the same file. This is a heuristic sufficient for the
  // structured prompt files in this codebase.
  const hasReasoning = /reasoning\s*:/.test(src);

  if (!hasReasoning) {
    violations.push(file.replace(root + '/', ''));
  }
}

if (violations.length > 0) {
  error('AI reasoning capture gate FAILED.');
  error(
    `The following prompt files call definePrompt() but do not include a "reasoning" field in their output schema:`,
  );
  for (const v of violations) {
    error(`  ✗ ${v}`);
  }
  error('');
  error(
    'Each prompt output schema must include a "reasoning" field (string or ReasoningSchema).',
  );
  error('See packages/core/src/ai/define-prompt.ts for the ReasoningSchema definition.');
  process.exit(1);
}

log(`✔ AI reasoning capture gate passed (${String(promptFiles.filter((f) => readFileSync(f, 'utf8').includes('definePrompt(')).length)} prompt file(s) checked).`);
