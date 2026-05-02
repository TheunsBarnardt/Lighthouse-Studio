/**
 * Dependency boundary checker. Wraps dependency-cruiser.
 * Run via `pnpm boundaries` or `pnpm boundaries:staged`.
 *
 * --staged flag: only check files that are staged for commit (used in pre-commit hook).
 */
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const STAGED = process.argv.includes('--staged');

function getStagedFiles(): string[] {
  try {
    const output = execSync('git diff --cached --name-only --diff-filter=ACM', {
      cwd: ROOT,
      encoding: 'utf8',
    });
    return output
      .trim()
      .split('\n')
      .filter((f) => f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.mts'));
  } catch {
    return [];
  }
}

// Use .CMD wrapper on Windows for reliable cross-platform invocation
const isWindows = process.platform === 'win32';
const depcruiseBin = join(ROOT, 'node_modules', '.bin', isWindows ? 'depcruise.CMD' : 'depcruise');

if (!existsSync(depcruiseBin)) {
  console.error('dependency-cruiser not found. Run `pnpm install` first.');
  process.exit(1);
}

const targetDirs = STAGED ? getStagedFiles() : ['packages', 'apps'];

if (STAGED && targetDirs.length === 0) {
  console.log('No TypeScript files staged — skipping boundary check.');
  process.exit(0);
}

try {
  execSync(
    `"${depcruiseBin}" --config .dependency-cruiser.cjs --output-type err ${targetDirs.join(' ')}`,
    { cwd: ROOT, stdio: 'inherit' },
  );
  console.log('\n✓ Boundary check passed.');
} catch {
  console.error('\n✗ Boundary violations found. Fix before committing.');
  process.exit(1);
}
