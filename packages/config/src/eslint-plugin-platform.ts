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

// ── Plugin export ──────────────────────────────────────────────────────────────

export const platformPlugin = {
  rules: {
    'service-method-context-first': serviceMethodContextFirst,
    'no-bare-error-throws': noBareErrorThrows,
    'audit-on-mutation': auditOnMutation,
  },
};
