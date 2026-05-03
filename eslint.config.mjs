import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import perfectionist from 'eslint-plugin-perfectionist';
import promise from 'eslint-plugin-promise';
import security from 'eslint-plugin-security';

// ── Windows / cross-platform rules (Objective 9) ──────────────────────────────

const noPathConcatenation = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Avoid path separator literals; use path.join() for cross-platform paths',
    },
    schema: [],
    messages: {
      noPathConcat:
        "Avoid '/' string literals in path concatenation. Use path.join() or path.resolve() instead.",
    },
  },
  create(context) {
    function isSep(node) {
      return node.type === 'Literal' && (node.value === '/' || node.value === '\\');
    }
    return {
      BinaryExpression(node) {
        if (node.operator !== '+') return;
        if (isSep(node.left) || isSep(node.right)) {
          context.report({ node, messageId: 'noPathConcat' });
        }
      },
    };
  },
};

const noHardcodedTmp = {
  meta: {
    type: 'suggestion',
    docs: { description: "Avoid hardcoded '/tmp'; use os.tmpdir() for cross-platform paths" },
    schema: [],
    messages: {
      noTmpPath: "Do not hardcode '/tmp'. Use os.tmpdir() for the platform temp directory.",
    },
  },
  create(context) {
    const TMP = /^(\/tmp\/|\\tmp\\)/;
    return {
      Literal(node) {
        if (typeof node.value === 'string' && TMP.test(node.value)) {
          context.report({ node, messageId: 'noTmpPath' });
        }
      },
      TemplateLiteral(node) {
        for (const q of node.quasis) {
          if (TMP.test(q.value.raw)) {
            context.report({ node, messageId: 'noTmpPath' });
            break;
          }
        }
      },
    };
  },
};

const noLinuxOnlySignals = {
  meta: {
    type: 'problem',
    docs: { description: 'Avoid POSIX-only signals that do not exist on Windows' },
    schema: [],
    messages: {
      noLinuxSignal:
        "'{{signal}}' is not available on Windows. Use SIGTERM or SIGINT for cross-platform shutdown.",
    },
  },
  create(context) {
    const LINUX_ONLY = new Set([
      'SIGUSR1',
      'SIGUSR2',
      'SIGHUP',
      'SIGPIPE',
      'SIGALRM',
      'SIGCHLD',
      'SIGCONT',
      'SIGSTOP',
      'SIGTSTP',
      'SIGTTIN',
      'SIGTTOU',
    ]);
    return {
      CallExpression(node) {
        const { callee, arguments: args } = node;
        if (
          callee.type !== 'MemberExpression' ||
          callee.object?.name !== 'process' ||
          (callee.property?.name !== 'on' && callee.property?.name !== 'once')
        )
          return;
        const first = args[0];
        if (
          first?.type === 'Literal' &&
          typeof first.value === 'string' &&
          LINUX_ONLY.has(first.value)
        ) {
          context.report({ node, messageId: 'noLinuxSignal', data: { signal: first.value } });
        }
      },
    };
  },
};

const platformPlugin = {
  rules: {
    'no-path-concatenation': noPathConcatenation,
    'no-hardcoded-tmp': noHardcodedTmp,
    'no-linux-only-signals': noLinuxOnlySignals,
  },
};

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/*.js',
      '**/*.cjs',
      '**/*.mjs',
      'prototype/**',
    ],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        projectService: {
          allowDefaultProject: ['apps/*/scripts/*.mts'],
          defaultProject: './packages/config/tsconfig.base.json',
        },
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      perfectionist,
      promise,
      security,
      platform: platformPlugin,
    },
    rules: {
      ...tseslint.configs['recommended-type-checked'].rules,
      ...tseslint.configs['strict-type-checked'].rules,
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      // False-positive when implementing generic interface methods (e.g., publish<T> must match port signature)
      '@typescript-eslint/no-unnecessary-type-parameters': 'off',
      'no-console': 'error',
      'perfectionist/sort-imports': ['warn', { type: 'natural' }],
      ...promise.configs['flat/recommended'].rules,
      ...security.configs.recommended.rules,
      // False-positive in TypeScript: keyof-typed bracket access is safe; rule doesn't understand TS types
      'security/detect-object-injection': 'off',
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['*/packages/adapters/*', '@platform/adapter-*'],
              message:
                'Adapters may only be imported from packages/composition. Use a port interface instead.',
            },
          ],
        },
      ],
      // Enforce that env vars are read through @platform/config, never via process.env directly.
      // Direct access bypasses validation and type-safety; missing vars fail silently at runtime.
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[object.name='process'][property.name='env']",
          message:
            'Access env vars through getEnv() from @platform/config, not process.env directly.',
        },
      ],

      // ── Windows / cross-platform rules (Objective 9) ──────────────────────
      'platform/no-path-concatenation': 'warn',
      'platform/no-hardcoded-tmp': 'error',
      'platform/no-linux-only-signals': 'error',
    },
  },
  {
    // Composition root is the only place allowed to import adapter packages
    files: ['packages/composition/**/*.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  {
    // The env package is the one place allowed to read process.env — it's the accessor layer
    files: ['packages/config/src/env/**/*.ts', 'packages/config/src/env/**/*.mts'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
  {
    // Tests wire adapters together; the composition-only rule does not apply in test files.
    // Non-null assertions (`x!`) are pragmatic in tests where the test setup guarantees presence.
    // process.env is allowed in test setup; fs non-literal paths are expected in test fixtures.
    files: ['**/*.spec.ts', '**/*.test.ts', '**/tests/**/*.ts'],
    rules: {
      'no-restricted-imports': 'off',
      'no-restricted-syntax': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      'security/detect-non-literal-fs-filename': 'off',
    },
  },
  {
    // Scripts are CLI tools: console output and direct fs/process access are intentional.
    // app/deploy scripts also use Windows-only deps (node-windows) via dynamic imports,
    // so unsafe-* and consistent-type-imports rules are relaxed here.
    files: [
      'scripts/**/*.mts',
      'apps/*/scripts/**/*.mts',
      'deploy/**/*.mts',
      'packages/db/seed/**/*.mts',
    ],
    rules: {
      'no-restricted-imports': 'off',
      'no-restricted-syntax': 'off',
      'no-console': 'off',
      'security/detect-non-literal-fs-filename': 'off',
      'security/detect-unsafe-regex': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/consistent-type-imports': 'off',
    },
  },
];
