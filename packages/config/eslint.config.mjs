import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import perfectionist from 'eslint-plugin-perfectionist';
import promise from 'eslint-plugin-promise';
import security from 'eslint-plugin-security';

// ── Platform-specific rules (Objective 8) ─────────────────────────────────────

/**
 * Every public async method on a class ending in 'Service' must have its
 * first parameter named 'ctx'. This catches the most common mistake of
 * forgetting the context parameter on a new service method.
 */
const serviceMethodContextFirst = {
  meta: {
    type: 'suggestion',
    docs: { description: 'Service methods must accept ctx as their first parameter' },
    schema: [],
    messages: {
      missingCtx:
        "Public async method '{{name}}' on '{{className}}' must have 'ctx' as its first parameter.",
    },
  },
  create(context) {
    let currentClassName = '';
    return {
      ClassDeclaration(node) {
        currentClassName = node.id?.name ?? '';
      },
      ClassExpression(node) {
        currentClassName = node.id?.name ?? '';
      },
      'ClassDeclaration:exit'() {
        currentClassName = '';
      },
      'ClassExpression:exit'() {
        currentClassName = '';
      },
      MethodDefinition(node) {
        if (!currentClassName.endsWith('Service')) return;
        if (node.kind !== 'method') return;
        if (node.accessibility === 'private' || node.accessibility === 'protected') return;
        if (node.static) return;
        const fn = node.value;
        if (!fn.async) return;
        const methodName = node.key.type === 'Identifier' ? node.key.name : null;
        if (!methodName || methodName.startsWith('_')) return;
        const firstParam = fn.params[0];
        const hasCtx = firstParam?.type === 'Identifier' && firstParam.name === 'ctx';
        if (!hasCtx) {
          context.report({
            node,
            messageId: 'missingCtx',
            data: { name: methodName, className: currentClassName },
          });
        }
      },
    };
  },
};

/**
 * Public async methods on Service classes with an explicit return type
 * annotation must include `Result` in that annotation. Unannotated methods
 * are skipped — TypeScript catches mismatches at the call site.
 */
const serviceMethodReturnsResult = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Annotated public async Service methods must return Promise<Result<T, AppError>>',
    },
    schema: [],
    messages: {
      missingResult:
        "Method '{{name}}' on '{{className}}' has return type '{{type}}' which does not include Result. Use Promise<Result<T, AppError>>.",
    },
  },
  create(context) {
    let currentClassName = '';
    function checkReturnType(methodNode, methodName, fn) {
      if (!fn.returnType) return;
      const typeSrc = context.getSourceCode().getText(fn.returnType);
      if (!typeSrc.includes('Result')) {
        context.report({
          node: methodNode,
          messageId: 'missingResult',
          data: { name: methodName, className: currentClassName, type: typeSrc.trim() },
        });
      }
    }
    return {
      ClassDeclaration(node) {
        currentClassName = node.id?.name ?? '';
      },
      ClassExpression(node) {
        currentClassName = node.id?.name ?? '';
      },
      'ClassDeclaration:exit'() {
        currentClassName = '';
      },
      'ClassExpression:exit'() {
        currentClassName = '';
      },
      MethodDefinition(node) {
        if (!currentClassName.endsWith('Service')) return;
        if (node.kind !== 'method') return;
        if (node.accessibility === 'private' || node.accessibility === 'protected') return;
        if (node.static) return;
        const fn = node.value;
        if (!fn.async) return;
        const methodName = node.key.type === 'Identifier' ? node.key.name : null;
        if (!methodName || methodName.startsWith('_')) return;
        checkReturnType(node, methodName, fn);
      },
    };
  },
};

/**
 * `throw new Error(...)` is forbidden in service code. Use a typed AppError
 * subclass so errors are machine-readable and HTTP-mappable.
 */
const noBareErrorThrows = {
  meta: {
    type: 'problem',
    docs: { description: 'Forbid bare Error throws — use a typed AppError subclass' },
    schema: [],
    messages: {
      noBareThrow:
        'Do not throw bare Error. Use ValidationError, NotFoundError, InternalError, etc.',
    },
  },
  create(context) {
    return {
      ThrowStatement(node) {
        if (
          node.argument.type === 'NewExpression' &&
          node.argument.callee.type === 'Identifier' &&
          node.argument.callee.name === 'Error'
        ) {
          context.report({ node, messageId: 'noBareThrow' });
        }
      },
    };
  },
};

/**
 * Heuristic: mutation methods (create/update/delete/archive/restore/…) on
 * Service classes should call `audit.write(`. Soft warning — heuristics
 * have false positives for non-state-changing overloads.
 */
const auditOnMutation = {
  meta: {
    type: 'suggestion',
    docs: { description: 'State-changing service methods should emit an audit event' },
    schema: [],
    messages: {
      missingAudit:
        "Method '{{name}}' looks like a state change but has no 'audit.write' call. Add an audit emission or suppress this warning with a comment.",
    },
  },
  create(context) {
    let currentClassName = '';
    const MUTATION_NAMES = new Set([
      'create',
      'update',
      'delete',
      'archive',
      'restore',
      'approve',
      'reject',
      'transfer',
      'revoke',
      'enable',
      'disable',
      'publish',
      'unpublish',
      'addMember',
      'remove',
    ]);
    return {
      ClassDeclaration(node) {
        currentClassName = node.id?.name ?? '';
      },
      ClassExpression(node) {
        currentClassName = node.id?.name ?? '';
      },
      'ClassDeclaration:exit'() {
        currentClassName = '';
      },
      'ClassExpression:exit'() {
        currentClassName = '';
      },
      MethodDefinition(node) {
        if (!currentClassName.endsWith('Service')) return;
        if (node.kind !== 'method') return;
        if (node.accessibility === 'private' || node.accessibility === 'protected') return;
        const methodName = node.key.type === 'Identifier' ? node.key.name : null;
        if (!methodName || !MUTATION_NAMES.has(methodName)) return;
        const body = node.value.body;
        if (!body) return;
        const src = context.getSourceCode().getText(body);
        if (!src.includes('audit.write')) {
          context.report({ node, messageId: 'missingAudit', data: { name: methodName } });
        }
      },
    };
  },
};

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

// ── Platform plugin ────────────────────────────────────────────────────────────

const platformPlugin = {
  rules: {
    'service-method-context-first': serviceMethodContextFirst,
    'service-method-returns-result': serviceMethodReturnsResult,
    'no-bare-error-throws': noBareErrorThrows,
    'audit-on-mutation': auditOnMutation,
    'no-path-concatenation': noPathConcatenation,
    'no-hardcoded-tmp': noHardcodedTmp,
    'no-linux-only-signals': noLinuxOnlySignals,
  },
};

// ── Main config ────────────────────────────────────────────────────────────────

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
        projectService: {
          allowDefaultProject: ['tests/**/*.ts', 'tests/**/*.tsx'],
          defaultProject: './tsconfig.test.json',
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

      // ── Platform service layer conventions (Objective 8) ──────────────────
      // Every public async Service method must receive ctx as first param
      'platform/service-method-context-first': 'error',
      // Annotated async Service methods must return Promise<Result<T, AppError>>
      'platform/service-method-returns-result': 'error',
      // No bare `throw new Error(...)` in service code — use typed AppError
      'platform/no-bare-error-throws': 'error',
      // ── Authorization enforcement (Objective 6) ───────────────────────────
      // Non-read-only async Service methods should call authz.authorize()
      'platform/require-authz-call': 'warn',
      // Mutation methods (create/update/delete/…) should audit — soft warning
      'platform/audit-on-mutation': 'warn',

      // ── Windows / cross-platform rules (Objective 9) ──────────────────────
      'platform/no-path-concatenation': 'warn',
      'platform/no-hardcoded-tmp': 'error',
      'platform/no-linux-only-signals': 'error',
    },
  },
];
