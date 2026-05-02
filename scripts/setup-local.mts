#!/usr/bin/env tsx
/**
 * Local development setup script.
 * Run via: pnpm setup
 *
 * Idempotent — safe to run multiple times.
 * Works on Linux, macOS, and Windows (Git Bash or PowerShell).
 */

import { execSync, spawnSync } from 'child_process';
import { existsSync, readFileSync, copyFileSync } from 'fs';
import { platform } from 'os';
import { join, resolve } from 'path';
import { createInterface } from 'readline';

const ROOT = resolve(import.meta.dirname, '..');
const REQUIRED_NODE_MAJOR = 22;
const REQUIRED_PNPM_MAJOR = 10;

const isWindows = platform() === 'win32';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function print(msg: string): void {
  process.stdout.write(msg + '\n');
}

function step(label: string): void {
  print(`\n▶  ${label}`);
}

function ok(msg: string): void {
  print(`   ✓  ${msg}`);
}

function warn(msg: string): void {
  print(`   ⚠  ${msg}`);
}

function fail(msg: string): never {
  print(`\n   ✗  ${msg}\n`);
  process.exit(1);
}

function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`   ? ${question} `, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function run(cmd: string, opts: { silent?: boolean } = {}): string {
  try {
    return execSync(cmd, {
      encoding: 'utf8',
      stdio: opts.silent ? 'pipe' : 'inherit',
      cwd: ROOT,
    }).trim();
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// Step 1: Node version
// ---------------------------------------------------------------------------

step('Checking Node.js version');

const nvmrcPath = join(ROOT, '.nvmrc');
const requiredNode = existsSync(nvmrcPath)
  ? readFileSync(nvmrcPath, 'utf8').trim()
  : String(REQUIRED_NODE_MAJOR);
const currentNode = process.version.replace('v', '');
const currentMajor = parseInt(currentNode.split('.')[0] ?? '0', 10);

if (currentMajor < REQUIRED_NODE_MAJOR) {
  fail(
    `Node.js ${requiredNode} or later required; you have ${process.version}. ` +
      `Install via nvm: nvm install ${requiredNode} && nvm use ${requiredNode}`,
  );
}
ok(`Node.js ${process.version}`);

// ---------------------------------------------------------------------------
// Step 2: pnpm version
// ---------------------------------------------------------------------------

step('Checking pnpm version');

const pnpmVersion = run('pnpm --version', { silent: true });
if (!pnpmVersion) {
  fail('pnpm not found. Install it: corepack enable && corepack prepare pnpm@latest --activate');
}
const pnpmMajor = parseInt(pnpmVersion.split('.')[0] ?? '0', 10);
if (pnpmMajor < REQUIRED_PNPM_MAJOR) {
  fail(
    `pnpm ${String(REQUIRED_PNPM_MAJOR)}+ required; you have ${pnpmVersion}. Run: corepack prepare pnpm@latest --activate`,
  );
}
ok(`pnpm ${pnpmVersion}`);

// ---------------------------------------------------------------------------
// Step 3: Install dependencies
// ---------------------------------------------------------------------------

step('Installing dependencies');
run('pnpm install --frozen-lockfile');
ok('Dependencies installed');

// ---------------------------------------------------------------------------
// Step 4: .env.local
// ---------------------------------------------------------------------------

step('Checking environment file');

const envLocalPath = join(ROOT, '.env.local');
const envExamplePath = join(ROOT, '.env.example');

if (!existsSync(envLocalPath)) {
  warn('.env.local not found — copying from .env.example');
  copyFileSync(envExamplePath, envLocalPath);
  print('');
  print('   .env.local has been created from .env.example.');
  print('   Open it and fill in the required values before running the app:');
  print('');
  print('     POSTGRES_URL      — connection string for your Postgres database');
  print('     AUTH_SECRET       — generate with: openssl rand -base64 48');
  print('     DOMAIN            — your configured domain (or leave as placeholder)');
  print('     ADMIN_EMAIL       — admin email for Caddy SSL certificate');
  print('');
} else {
  ok('.env.local exists');
}

// ---------------------------------------------------------------------------
// Step 5: Validate env
// ---------------------------------------------------------------------------

step('Validating environment variables');

const validateResult = spawnSync('tsx', ['packages/config/src/env/validate.mts'], {
  encoding: 'utf8',
  cwd: ROOT,
  env: { ...process.env, LOAD_ENV_FROM: envLocalPath },
});

if (validateResult.status !== 0) {
  warn('Environment validation failed. Check the errors above, then re-run pnpm setup.');
  warn('The .env.example file has documentation for every variable.');
} else {
  ok('Environment variables are valid');
}

// ---------------------------------------------------------------------------
// Step 6: Platform-specific notes
// ---------------------------------------------------------------------------

step('Platform notes');

if (isWindows) {
  print('');
  print('   Running on Windows. A few notes:');
  print('   • Use Git Bash or WSL2 for shell scripts');
  print('   • Docker Desktop must be installed and running for offline mode');
  print('   • Run `pnpm setup:local-db` to start a local Postgres + Redis via Docker');
}

if (platform() === 'darwin') {
  print('');
  print('   Running on macOS. A few notes:');
  print('   • Docker Desktop must be installed and running for offline mode');
}

// ---------------------------------------------------------------------------
// Step 7: Optional local DB
// ---------------------------------------------------------------------------

const dockerAvailable = run('docker info', { silent: true }).includes('Server Version');

if (dockerAvailable) {
  step('Local Docker database (optional)');
  print('');
  print('   You can run a local Postgres + Redis using Docker (offline mode).');
  print('   This mirrors the dev environment without needing internet access.');
  print('');

  const answer = await prompt('Start local Postgres + Redis via Docker? [y/N]');
  if (answer.toLowerCase() === 'y') {
    run(`docker compose -f infra/docker/local.yml up -d`);
    ok('Local Postgres (port 5432) and Redis (port 6379) started');
    print('');
    print('   Update .env.local with:');
    print('     POSTGRES_URL=postgres://platform:platform@localhost:5432/platform_dev');
    print('     REDIS_URL=redis://localhost:6379');
  } else {
    ok('Skipped (you can run `pnpm setup:local-db` later)');
  }
} else {
  warn(
    'Docker not available — skipping local DB offer. Install Docker Desktop to use offline mode.',
  );
}

// ---------------------------------------------------------------------------
// Step 8: Placeholder db:generate / seed
// ---------------------------------------------------------------------------

step('Database (placeholder — will execute in Objective 4)');
ok('db:generate — not yet implemented (Objective 4)');
ok('seed:dev    — not yet implemented (Objective 4)');

// ---------------------------------------------------------------------------
// Done
// ---------------------------------------------------------------------------

print('');
print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
print('  Setup complete. Next steps:');
print('');
print('  1. Edit .env.local and fill in any missing values');
print('  2. pnpm dev            — start the dev server');
print('  3. Visit http://localhost:3000/_status to verify the app is healthy');
print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
print('');
