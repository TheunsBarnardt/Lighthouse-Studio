/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-port-imports-adapter',
      severity: 'error',
      comment: 'Ports must not depend on adapters — that inverts the dependency direction',
      from: { path: '^packages/ports/' },
      to: { path: '^packages/adapters/' },
    },
    {
      name: 'no-application-imports-adapter',
      severity: 'error',
      comment: 'Only the composition root may import adapters',
      from: {
        path: '^(apps/|packages/(core|ui|observability|shared|ports)/)',
      },
      to: { path: '^packages/adapters/' },
    },
    {
      name: 'no-port-imports-driver',
      severity: 'error',
      comment: 'Ports must not depend on driver libraries directly',
      from: { path: '^packages/ports/' },
      to: {
        dependencyTypes: ['npm'],
        path: '^(pg|mssql|mongodb|@prisma/client|drizzle-orm|aws-sdk|@aws-sdk/|@azure/storage-blob|nodemailer|@sendgrid/mail|mysql2|better-sqlite3)$',
      },
    },
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Circular dependencies are forbidden',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-orphans',
      severity: 'warn',
      comment: 'Orphaned modules — likely forgot to export or import',
      from: {
        orphan: true,
        pathNot: [
          '\\.d\\.ts$',
          '(^|/)\\.',
          '\\.config\\.(js|cjs|mjs|ts|mts)$',
          '\\.test\\.',
          '\\.spec\\.',
          '(^|/)(dist|coverage)/',
        ],
      },
      to: {},
    },
  ],
  options: {
    doNotFollow: {
      path: 'node_modules',
      dependencyTypes: ['npm', 'npm-dev', 'npm-optional', 'npm-peer', 'npm-bundled', 'npm-no-pkg'],
    },
    exclude: {
      path: '(^|/)node_modules/|(^|/)(dist|coverage)/',
    },
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
    },
    progress: { type: 'cli-feedback' },
    reporterOptions: {
      dot: { collapsePattern: 'node_modules/[^/]+' },
      archi: { collapsePattern: '^(packages|apps)/[^/]+' },
    },
  },
};
