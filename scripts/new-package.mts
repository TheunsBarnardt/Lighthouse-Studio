/**
 * Interactive generator for new workspace packages.
 * Run via `pnpm new-package`.
 */
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';

const ROOT = process.cwd();

const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = (q: string): Promise<string> =>
  new Promise((resolve) => {
    rl.question(q, (a) => {
      resolve(a.trim());
    });
  });

type PackageType = 'port' | 'adapter' | 'app' | 'lib';

async function main(): Promise<void> {
  console.log('\n📦 New Package Generator\n');

  const typeAnswer = await ask('Package type? (port/adapter/app/lib): ');
  const pkgType = typeAnswer as PackageType;
  if (!['port', 'adapter', 'app', 'lib'].includes(pkgType)) {
    console.error('Invalid type. Choose: port, adapter, app, or lib');
    process.exit(1);
  }

  const name = await ask('Package name (e.g. "postgres" for an adapter, "email" for a port): ');
  if (!name || !/^[a-z][a-z0-9-]*$/.test(name)) {
    console.error('Name must be lowercase alphanumeric with hyphens.');
    process.exit(1);
  }

  let implementsPort = '';
  if (pkgType === 'adapter') {
    implementsPort = await ask('Which port does this adapter implement? (e.g. "persistence"): ');
  }

  rl.close();

  const { dir, scopedName } = resolvePackagePath(pkgType, name, implementsPort);

  if (existsSync(dir)) {
    console.error(`Package already exists at: ${dir}`);
    process.exit(1);
  }

  mkdirSync(join(dir, 'src'), { recursive: true });

  const pkg = {
    name: scopedName,
    version: '0.0.0',
    private: true,
    type: 'module',
    main: './dist/index.js',
    types: './dist/index.d.ts',
    exports: { '.': { import: './dist/index.js', types: './dist/index.d.ts' } },
    scripts: {
      build: 'tsc -p tsconfig.json',
      typecheck: 'tsc -p tsconfig.json --noEmit',
      test: 'vitest run',
      'test:watch': 'vitest',
      lint: 'eslint src',
      clean: 'rimraf dist',
    },
    devDependencies: buildDevDeps(pkgType, implementsPort),
    ...(pkgType === 'adapter' && implementsPort
      ? { keywords: [`implements-port:${implementsPort}`] }
      : {}),
  };

  writeFileSync(join(dir, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');

  writeFileSync(
    join(dir, 'tsconfig.json'),
    JSON.stringify(
      {
        extends: '@platform/config/tsconfig/lib.json',
        compilerOptions: {
          outDir: './dist',
          rootDir: './src',
          tsBuildInfoFile: './dist/.tsbuildinfo',
        },
        include: ['src'],
        exclude: ['dist', 'node_modules', '**/*.test.ts', '**/*.spec.ts'],
      },
      null,
      2,
    ) + '\n',
  );

  const indexContent =
    pkgType === 'port'
      ? `// Port: ${name}\nexport {};\n`
      : pkgType === 'adapter'
        ? `// Adapter: ${name} — implements @platform/ports-${implementsPort}\nexport {};\n`
        : `export {};\n`;
  writeFileSync(join(dir, 'src', 'index.ts'), indexContent);

  writeFileSync(
    join(dir, 'README.md'),
    `# ${scopedName}\n\n${getDescription(pkgType, name, implementsPort)}\n`,
  );

  addTsconfigReference(dir);

  console.log('\nRunning pnpm install...');
  execSync('pnpm install', { cwd: ROOT, stdio: 'inherit' });

  console.log(`\n✓ Created ${scopedName} at ${dir}`);
}

function resolvePackagePath(
  type: PackageType,
  name: string,
  port: string,
): { dir: string; scopedName: string } {
  switch (type) {
    case 'port':
      return { dir: join(ROOT, 'packages', 'ports', name), scopedName: `@platform/ports-${name}` };
    case 'adapter':
      return {
        dir: join(ROOT, 'packages', 'adapters', `${port}-${name}`),
        scopedName: `@platform/adapter-${port}-${name}`,
      };
    case 'app':
      return { dir: join(ROOT, 'apps', name), scopedName: `@platform/${name}` };
    case 'lib':
      return { dir: join(ROOT, 'packages', name), scopedName: `@platform/${name}` };
  }
}

function buildDevDeps(type: PackageType, port: string): Record<string, string> {
  const base: Record<string, string> = {
    '@platform/config': 'workspace:*',
    '@platform/shared': 'workspace:*',
    rimraf: '6.0.1',
    vitest: '3.2.3',
  };
  if (type === 'adapter' && port) {
    base[`@platform/ports-${port}`] = 'workspace:*';
  }
  return base;
}

function getDescription(type: PackageType, name: string, port: string): string {
  switch (type) {
    case 'port':
      return `Port interface for ${name}. Define abstractions here; implementations live in adapter packages.`;
    case 'adapter':
      return `Adapter implementing \`@platform/ports-${port}\` using ${name}.`;
    case 'app':
      return `Application: ${name}.`;
    case 'lib':
      return `Library: ${name}.`;
  }
}

function addTsconfigReference(pkgDir: string): void {
  const tsconfigPath = join(ROOT, 'tsconfig.json');
  interface TsConfig {
    files: never[];
    references: Array<{ path: string }>;
  }
  const tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf8')) as TsConfig;
  const relPath = pkgDir
    .replace(ROOT, '')
    .replace(/^[/\\]/, '')
    .replace(/\\/g, '/');

  if (!tsconfig.references.some((r) => r.path === relPath)) {
    tsconfig.references.push({ path: relPath });
    tsconfig.references.sort((a, b) => a.path.localeCompare(b.path));
    writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2) + '\n');
    console.log(`Updated tsconfig.json with reference to ${relPath}`);
  }
}

await main();
