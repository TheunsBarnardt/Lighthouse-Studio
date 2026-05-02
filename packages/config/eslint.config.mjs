import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import perfectionist from 'eslint-plugin-perfectionist';
import promise from 'eslint-plugin-promise';
import security from 'eslint-plugin-security';

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/*.js', '**/*.cjs', '**/*.mjs'],
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
      // TypeScript strict rules
      ...tseslint.configs['recommended-type-checked'].rules,
      ...tseslint.configs['strict-type-checked'].rules,

      // Async correctness
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      // False-positive when implementing generic interface methods (e.g., publish<T> must match the port signature)
      '@typescript-eslint/no-unnecessary-type-parameters': 'off',

      // Force structured logging — no console.log in production code
      'no-console': 'error',

      // Import sorting
      'perfectionist/sort-imports': ['warn', { type: 'natural' }],

      // Promise correctness
      ...promise.configs['flat/recommended'].rules,

      // Security
      ...security.configs.recommended.rules,

      // Restrict raw env / adapter access
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
          paths: [
            {
              name: 'process',
              importNames: ['env'],
              message: 'Access env vars only through @platform/ports-config or the config package.',
            },
          ],
        },
      ],
    },
  },
];
