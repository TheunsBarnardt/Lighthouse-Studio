/**
 * Workspace sanity checks. Run via `pnpm check-workspace`.
 * Fails with non-zero exit if any invariant is violated.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();

interface PackageJson {
  name?: string;
  version?: string;
  type?: string;
  private?: boolean;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

const errors: string[] = [];
const warnings: string[] = [];

function readJson(path: string): PackageJson | null {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as PackageJson;
  } catch {
    return null;
  }
}

function checkPackage(dir: string): void {
  const rel = relative(ROOT, dir);
  const pkgPath = join(dir, 'package.json');
  const tsconfigPath = join(dir, 'tsconfig.json');
  const readmePath = join(dir, 'README.md');

  if (!existsSync(pkgPath)) {
    errors.push(`${rel}: missing package.json`);
    return;
  }

  const pkg = readJson(pkgPath);
  if (!pkg) {
    errors.push(`${rel}: package.json is not valid JSON`);
    return;
  }

  if (!pkg.name) errors.push(`${rel}: package.json missing "name"`);
  if (!pkg.version) errors.push(`${rel}: package.json missing "version"`);
  if (pkg.type !== 'module') errors.push(`${rel}: package.json must have "type": "module"`);

  if (!existsSync(readmePath)) {
    warnings.push(`${rel}: missing README.md`);
  }

  const hasSrc = existsSync(join(dir, 'src'));
  if (hasSrc && !existsSync(tsconfigPath)) {
    warnings.push(`${rel}: missing tsconfig.json (has src/ but no tsconfig.json)`);
  }

  // Cross-package deps must use workspace protocol
  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
  for (const [dep, version] of Object.entries(allDeps)) {
    if (dep.startsWith('@platform/') && !String(version).startsWith('workspace:')) {
      errors.push(
        `${rel}: cross-workspace dep "${dep}" must use "workspace:*" not "${String(version)}"`,
      );
    }
  }
}

function collectPackageDirs(base: string): string[] {
  if (!existsSync(base)) return [];
  return readdirSync(base, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => join(base, e.name));
}

const packageDirs = [
  ...collectPackageDirs(join(ROOT, 'packages')),
  ...collectPackageDirs(join(ROOT, 'packages', 'ports')),
  ...collectPackageDirs(join(ROOT, 'packages', 'adapters')),
  ...collectPackageDirs(join(ROOT, 'apps')),
].filter((d) => existsSync(join(d, 'package.json')));

for (const dir of packageDirs) {
  checkPackage(dir);
}

if (warnings.length > 0) {
  console.warn('\nWarnings:');
  for (const w of warnings) console.warn(`  ⚠  ${w}`);
}

if (errors.length > 0) {
  console.error('\nErrors:');
  for (const e of errors) console.error(`  ✗  ${e}`);
  console.error(`\ncheck-workspace failed with ${String(errors.length)} error(s).`);
  process.exit(1);
} else {
  console.log(`\n✓ check-workspace passed (${String(packageDirs.length)} packages checked)`);
}
