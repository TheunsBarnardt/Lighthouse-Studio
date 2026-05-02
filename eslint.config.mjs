import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import perfectionist from 'eslint-plugin-perfectionist';
import promise from 'eslint-plugin-promise';
import security from 'eslint-plugin-security';

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
        projectService: true,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      perfectionist,
      promise,
      security,
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
    // Scripts are CLI tools: console output and direct fs/process access are intentional
    files: ['scripts/**/*.mts', 'packages/db/seed/**/*.mts'],
    rules: {
      'no-restricted-imports': 'off',
      'no-restricted-syntax': 'off',
      'no-console': 'off',
      'security/detect-non-literal-fs-filename': 'off',
      'security/detect-unsafe-regex': 'off',
    },
  },
];
