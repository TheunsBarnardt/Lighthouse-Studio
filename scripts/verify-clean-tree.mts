/**
 * Verifies there are no untracked build artifacts that should not exist.
 * Run via `pnpm verify-clean-tree` (called from pre-push hook).
 */
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();

const result = execFileSync('git', ['status', '--porcelain'], {
  cwd: ROOT,
  encoding: 'utf8',
});

const untrackedBuildArtifacts = result
  .split('\n')
  .filter((line) => line.startsWith('??'))
  .map((line) => line.slice(3).trim())
  .filter(
    (f) =>
      f.includes('/dist/') ||
      f.endsWith('.tsbuildinfo') ||
      f.includes('/.next/') ||
      f.includes('/coverage/'),
  );

if (untrackedBuildArtifacts.length > 0) {
  console.error('\n✗ Untracked build artifacts found (should be in .gitignore):');
  for (const f of untrackedBuildArtifacts) {
    console.error(`  ${f}`);
  }
  process.exit(1);
}

console.log('✓ Working tree is clean of build artifacts.');
