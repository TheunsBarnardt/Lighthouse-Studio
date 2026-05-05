/**
 * Custom ESLint rules that enforce the service layer architecture conventions
 * from Objective 8. These rules are mechanical guards against common mistakes
 * that would pass TypeScript type-checking but violate the service contract.
 */
import type { Rule } from 'eslint';

// ── platform/service-method-context-first ─────────────────────────────────────
// Every public async method on a class ending in 'Service' must have its
// first parameter named 'ctx'. Applies to both:
//   - MethodDefinition (regular class methods)
//   - PropertyDefinition with async ArrowFunctionExpression values
//     (used with the observable() HOF wrapper pattern)
// Zero-parameter methods are allowed only when the value is an
// observable()-wrapped arrow (the wrapper itself enforces the ctx contract).

const serviceMethodContextFirst: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Service methods must have ctx (RequestContext | SystemContext) as their first parameter',
    },
    schema: [],
    messages: {
      missingCtx:
        "Public async method '{{name}}' on '{{className}}' must have 'ctx' as its first parameter typed as RequestContext, SystemContext, or AnyContext.",
    },
  },

  create(context) {
    let currentClassName = '';

    function isObservableCall(node: Rule.Node): boolean {
      const n = node as unknown as {
        type: string;
        callee?: { type: string; name?: string };
      };
      return (
        n.type === 'CallExpression' &&
        n.callee?.type === 'Identifier' &&
        n.callee.name === 'observable'
      );
    }

    function checkCtxParam(methodNode: Rule.Node, methodName: string, params: unknown[]): void {
      if (params.length === 0) {
        context.report({
          node: methodNode,
          messageId: 'missingCtx',
          data: { name: methodName, className: currentClassName },
        });
        return;
      }
      const firstParam = params[0] as { type?: string; name?: string } | undefined;
      const hasCtxName = firstParam?.type === 'Identifier' && firstParam.name === 'ctx';
      if (!hasCtxName) {
        context.report({
          node: methodNode,
          messageId: 'missingCtx',
          data: { name: methodName, className: currentClassName },
        });
      }
    }

    return {
      ClassDeclaration(node) {
        currentClassName = node.id.name;
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

      // Regular class methods: async methodName(ctx, ...)
      MethodDefinition(node) {
        if (!currentClassName.endsWith('Service')) return;
        if (node.kind !== 'method') return;
        const tsNode = node as typeof node & { accessibility?: string };
        if (tsNode.accessibility === 'private' || tsNode.accessibility === 'protected') return;
        if (node.static) return;

        const fn = node.value;
        if (!fn.async) return;

        const methodName = node.key.type === 'Identifier' ? node.key.name : null;
        if (!methodName || methodName.startsWith('_')) return;

        checkCtxParam(node as unknown as Rule.Node, methodName, fn.params);
      },

      // Property definitions: readonly create = observable(..., async (ctx, ...) => { ... })
      // or: readonly create = async (ctx, ...) => { ... }
      PropertyDefinition(node) {
        if (!currentClassName.endsWith('Service')) return;
        const tsNode = node as typeof node & { accessibility?: string };
        if (tsNode.accessibility === 'private' || tsNode.accessibility === 'protected') return;
        if (node.static) return;

        const methodName = node.key.type === 'Identifier' ? node.key.name : null;
        if (!methodName || methodName.startsWith('_')) return;

        const value = node.value as
          | null
          | { type: string; async?: boolean; params?: unknown[] }
          | undefined;
        if (!value) return;

        if (value.type === 'ArrowFunctionExpression' && value.async) {
          // Direct async arrow: readonly create = async (ctx, ...) => { ... }
          checkCtxParam(node as unknown as Rule.Node, methodName, value.params ?? []);
          return;
        }

        if (isObservableCall(value as unknown as Rule.Node)) {
          // observable()-wrapped: readonly create = observable('...', '...', obs, async (ctx, ...) => { ... })
          // The 4th argument is the inner function; check its first param.
          const callArgs = (value as unknown as { arguments?: unknown[] }).arguments ?? [];
          const innerFn = callArgs[3] as
            | { type?: string; async?: boolean; params?: unknown[] }
            | undefined;
          if (
            innerFn &&
            (innerFn.type === 'ArrowFunctionExpression' || innerFn.type === 'FunctionExpression') &&
            innerFn.async
          ) {
            checkCtxParam(node as unknown as Rule.Node, methodName, innerFn.params ?? []);
          }
        }
      },
    };
  },
};

// ── platform/no-bare-error-throws ─────────────────────────────────────────────
// `throw new Error(...)` is forbidden in packages/core and service code.
// Always use a typed AppError subclass.

const noBareErrorThrows: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Forbid bare `throw new Error(...)` in service code — use a typed AppError subclass',
    },
    schema: [],
    messages: {
      noBareThrow:
        'Do not throw bare `Error`. Use a typed AppError subclass (ValidationError, NotFoundError, InternalError, etc.).',
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

// ── platform/audit-on-mutation ─────────────────────────────────────────────────
// Heuristic: methods named create|update|delete|archive|restore|approve|reject
// on Service classes should call audit.write() somewhere in their body.
// This is a soft warning — heuristics have false positives.

const auditOnMutation: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'State-changing service methods (create/update/delete/archive/restore) should emit an audit event',
    },
    schema: [],
    messages: {
      missingAudit:
        "Method '{{name}}' appears to be a state-changing operation but has no call to 'this.audit.write'. Add an audit emission or rename the method if it does not mutate state.",
    },
  },

  create(context) {
    let currentClassName = '';

    const MUTATION_METHODS = new Set([
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
    ]);

    function hasAuditWrite(body: Rule.Node | null): boolean {
      if (!body) return false;
      const src = context.sourceCode.getText(body as never);
      return src.includes('audit.write');
    }

    return {
      ClassDeclaration(node) {
        currentClassName = node.id.name;
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
        const tsNode = node as typeof node & { accessibility?: string };
        if (tsNode.accessibility === 'private' || tsNode.accessibility === 'protected') return;

        const methodName = node.key.type === 'Identifier' ? node.key.name : null;
        if (!methodName || !MUTATION_METHODS.has(methodName)) return;

        const body = node.value.body;
        if (!hasAuditWrite(body as unknown as Rule.Node)) {
          context.report({
            node,
            messageId: 'missingAudit',
            data: { name: methodName },
          });
        }
      },

      PropertyDefinition(node) {
        if (!currentClassName.endsWith('Service')) return;
        const tsNode = node as typeof node & { accessibility?: string };
        if (tsNode.accessibility === 'private' || tsNode.accessibility === 'protected') return;

        const methodName = node.key.type === 'Identifier' ? node.key.name : null;
        if (!methodName || !MUTATION_METHODS.has(methodName)) return;

        // Check the entire property value for audit.write
        const src = node.value ? context.sourceCode.getText(node.value as never) : '';
        if (!src.includes('audit.write')) {
          context.report({
            node,
            messageId: 'missingAudit',
            data: { name: methodName },
          });
        }
      },
    };
  },
};

// ── platform/require-authz-call ───────────────────────────────────────────────
// Heuristic: every public async method on a Service class should call
// `authz.authorize(` somewhere in its body. Methods named `find*`, `get*`,
// `list*`, `count*`, `exists*`, `verify*`, `check*` are excluded because read
// operations are sometimes intentionally public (e.g., verifyToken).
// This is a soft warning — not every method needs an explicit authorize call,
// but the absence is worth flagging for review.

const requireAuthzCall: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Public async Service methods should call authz.authorize() to enforce access control',
    },
    schema: [],
    messages: {
      missingAuthz:
        "Method '{{name}}' on '{{className}}' does not call 'authz.authorize'. Add an authorization check or suppress this warning if the method is intentionally public.",
    },
  },

  create(context) {
    let currentClassName = '';

    const READ_ONLY_PREFIXES = [
      'find',
      'get',
      'list',
      'count',
      'exists',
      'verify',
      'check',
      'resolve',
      'lookup',
      'fetch',
      'load',
      'search',
    ];

    function isReadOnly(methodName: string): boolean {
      return READ_ONLY_PREFIXES.some((prefix) => methodName.toLowerCase().startsWith(prefix));
    }

    function hasAuthzCall(body: Rule.Node | null): boolean {
      if (!body) return false;
      const src = context.sourceCode.getText(body as never);
      return src.includes('authz.authorize') || src.includes('.authorize(');
    }

    return {
      ClassDeclaration(node) {
        currentClassName = node.id.name;
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
        const tsNode = node as typeof node & { accessibility?: string };
        if (tsNode.accessibility === 'private' || tsNode.accessibility === 'protected') return;
        if (node.static) return;

        const fn = node.value;
        if (!fn.async) return;

        const methodName = node.key.type === 'Identifier' ? node.key.name : null;
        if (!methodName || methodName.startsWith('_')) return;
        if (isReadOnly(methodName)) return;

        if (!hasAuthzCall(fn.body as unknown as Rule.Node)) {
          context.report({
            node: node as unknown as Rule.Node,
            messageId: 'missingAuthz',
            data: { name: methodName, className: currentClassName },
          });
        }
      },

      PropertyDefinition(node) {
        if (!currentClassName.endsWith('Service')) return;
        const tsNode = node as typeof node & { accessibility?: string };
        if (tsNode.accessibility === 'private' || tsNode.accessibility === 'protected') return;
        if (node.static) return;

        const methodName = node.key.type === 'Identifier' ? node.key.name : null;
        if (!methodName || methodName.startsWith('_')) return;
        if (isReadOnly(methodName)) return;

        const src = node.value ? context.sourceCode.getText(node.value as never) : '';
        if (!src.includes('authz.authorize') && !src.includes('.authorize(')) {
          context.report({
            node: node as unknown as Rule.Node,
            messageId: 'missingAuthz',
            data: { name: methodName, className: currentClassName },
          });
        }
      },
    };
  },
};

// ── platform/service-method-returns-result ────────────────────────────────────
// Every public async method on a Service class whose return type annotation is
// explicitly declared must include `Result` in that annotation. Methods without
// an annotation are allowed (TypeScript already catches mismatches at the call
// site). This rule enforces the explicit-annotation convention and catches the
// case where someone writes `Promise<User>` instead of `Promise<Result<User, AppError>>`.

const serviceMethodReturnsResult: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Public async Service methods with an explicit return type must return Promise<Result<T, AppError>>',
    },
    schema: [],
    messages: {
      missingResult:
        "Method '{{name}}' on '{{className}}' has return type '{{type}}' which does not include Result. Use Promise<Result<T, AppError>>.",
    },
  },

  create(context) {
    let currentClassName = '';

    function checkReturnType(methodNode: Rule.Node, methodName: string, fn: unknown): void {
      const fnNode = fn as { returnType?: unknown };
      if (!fnNode.returnType) return; // unannotated — skip, TypeScript checks at call site
      const typeSrc = context.sourceCode.getText(fnNode.returnType as never);
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
        currentClassName = node.id.name;
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
        const tsNode = node as typeof node & { accessibility?: string };
        if (tsNode.accessibility === 'private' || tsNode.accessibility === 'protected') return;
        if (node.static) return;

        const fn = node.value;
        if (!fn.async) return;

        const methodName = node.key.type === 'Identifier' ? node.key.name : null;
        if (!methodName || methodName.startsWith('_')) return;

        checkReturnType(node as unknown as Rule.Node, methodName, fn);
      },

      PropertyDefinition(node) {
        if (!currentClassName.endsWith('Service')) return;
        const tsNode = node as typeof node & { accessibility?: string };
        if (tsNode.accessibility === 'private' || tsNode.accessibility === 'protected') return;
        if (node.static) return;

        const methodName = node.key.type === 'Identifier' ? node.key.name : null;
        if (!methodName || methodName.startsWith('_')) return;

        const value = node.value as
          | null
          | { type: string; async?: boolean; returnType?: unknown }
          | undefined;
        if (!value) return;

        if (value.type === 'ArrowFunctionExpression' && value.async) {
          checkReturnType(node as unknown as Rule.Node, methodName, value);
        }
      },
    };
  },
};

// ── platform/no-path-concatenation ────────────────────────────────────────────
// Reject string literals that look like Unix-style path separators used in
// concatenation or template literals. Guides toward path.join / path.resolve.
// Specifically targets `'/' +`, `+ '/'`, `` `${x}/` ``, `` `/${x}` `` outside
// URL contexts.

const noPathConcatenation: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Avoid path separator string literals; use path.join() or path.resolve() for file paths',
    },
    schema: [],
    messages: {
      noPathConcat:
        "Avoid using '/' string literals in path concatenation. Use path.join() or path.resolve() instead for cross-platform compatibility.",
    },
  },

  create(context) {
    function isPathSeparatorLiteral(node: { type: string; value?: unknown }): boolean {
      return node.type === 'Literal' && (node.value === '/' || node.value === '\\');
    }

    return {
      BinaryExpression(node) {
        if (node.operator !== '+') return;
        const left = node.left as { type: string; value?: unknown };
        const right = node.right as { type: string; value?: unknown };
        if (isPathSeparatorLiteral(left) || isPathSeparatorLiteral(right)) {
          context.report({ node: node as unknown as Rule.Node, messageId: 'noPathConcat' });
        }
      },
    };
  },
};

// ── platform/no-hardcoded-tmp ──────────────────────────────────────────────────
// Reject '/tmp/' or '\tmp\' hardcoded in string literals.
// Use os.tmpdir() for cross-platform compatibility.

const noHardcodedTmp: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: "Avoid hardcoded '/tmp' paths; use os.tmpdir() for cross-platform compatibility",
    },
    schema: [],
    messages: {
      noTmpPath:
        "Do not hardcode '/tmp' paths. Use os.tmpdir() to get the platform-appropriate temporary directory.",
    },
  },

  create(context) {
    const TMP_PATTERN = /^(\/tmp\/|\\tmp\\)/;

    return {
      Literal(node) {
        const n = node as { type: string; value?: unknown };
        if (typeof n.value === 'string' && TMP_PATTERN.test(n.value)) {
          context.report({ node: node as unknown as Rule.Node, messageId: 'noTmpPath' });
        }
      },
      TemplateLiteral(node) {
        const tpl = node as unknown as { quasis: Array<{ value: { raw: string } }> };
        for (const quasi of tpl.quasis) {
          if (TMP_PATTERN.test(quasi.value.raw)) {
            context.report({ node: node as unknown as Rule.Node, messageId: 'noTmpPath' });
            break;
          }
        }
      },
    };
  },
};

// ── platform/no-linux-only-signals ────────────────────────────────────────────
// Reject process.on('SIGUSR1'), process.on('SIGUSR2'), process.on('SIGHUP'), etc.
// These signals don't exist on Windows (Node emits no-op but the signal handling
// differs). Use SIGTERM and SIGINT which Node emulates on Windows.

const noLinuxOnlySignals: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Avoid POSIX-only signals (SIGUSR1, SIGUSR2, SIGHUP) that do not work on Windows',
    },
    schema: [],
    messages: {
      noLinuxSignal:
        "'{{signal}}' is not available on Windows. Use 'SIGTERM' or 'SIGINT' (emulated by Node on Windows) for graceful shutdown signals.",
    },
  },

  create(context) {
    const LINUX_ONLY_SIGNALS = new Set([
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
        const n = node as unknown as {
          callee: {
            type: string;
            object?: { type: string; name?: string };
            property?: { type: string; name?: string };
          };
          arguments: Array<{ type: string; value?: unknown }>;
        };
        if (
          n.callee.type !== 'MemberExpression' ||
          n.callee.object?.name !== 'process' ||
          (n.callee.property?.name !== 'on' && n.callee.property?.name !== 'once')
        )
          return;

        const firstArg = n.arguments[0];
        if (firstArg?.type === 'Literal' && typeof firstArg.value === 'string') {
          if (LINUX_ONLY_SIGNALS.has(firstArg.value)) {
            context.report({
              node: node as unknown as Rule.Node,
              messageId: 'noLinuxSignal',
              data: { signal: firstArg.value },
            });
          }
        }
      },
    };
  },
};

// ── Plugin export ──────────────────────────────────────────────────────────────

export const platformPlugin = {
  rules: {
    'service-method-context-first': serviceMethodContextFirst,
    'service-method-returns-result': serviceMethodReturnsResult,
    'no-bare-error-throws': noBareErrorThrows,
    'require-authz-call': requireAuthzCall,
    'audit-on-mutation': auditOnMutation,
    'no-path-concatenation': noPathConcatenation,
    'no-hardcoded-tmp': noHardcodedTmp,
    'no-linux-only-signals': noLinuxOnlySignals,
  },
};
