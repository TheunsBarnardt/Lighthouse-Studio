import tsParser from '@typescript-eslint/parser';
import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';

import { platformPlugin } from '../../src/eslint-plugin-platform.js';

RuleTester.describe = describe;
RuleTester.it = it;

// TypeScript parser required — the rule inspects return type annotations
const tester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: 'module',
  },
});

tester.run('service-method-returns-result', platformPlugin.rules['service-method-returns-result'], {
  valid: [
    // No return type annotation — allowed (TypeScript enforces at call site)
    {
      code: `
          class WorkspaceService {
            async create(ctx: RequestContext, input: unknown) { return null; }
          }
        `,
    },
    // Correct annotation with Result — allowed
    {
      code: `
          class WorkspaceService {
            async create(ctx: RequestContext, input: unknown): Promise<Result<Workspace, AppError>> { return null; }
          }
        `,
    },
    // Non-service class — not checked
    {
      code: `
          class WorkspaceHelper {
            async create(ctx: RequestContext, input: unknown): Promise<User> { return null; }
          }
        `,
    },
    // Private method — not checked
    {
      code: `
          class WorkspaceService {
            private async _create(ctx: RequestContext): Promise<User> { return null; }
          }
        `,
    },
    // Static method — not checked
    {
      code: `
          class WorkspaceService {
            static async create(ctx: RequestContext): Promise<User> { return null; }
          }
        `,
    },
    // Non-async method — not checked
    {
      code: `
          class WorkspaceService {
            create(ctx: RequestContext): User { return null as unknown as User; }
          }
        `,
    },
  ],

  invalid: [
    // Explicit return type without Result — error
    {
      code: `
          class WorkspaceService {
            async create(ctx: RequestContext, input: unknown): Promise<Workspace> { return null as unknown as Workspace; }
          }
        `,
      errors: [{ messageId: 'missingResult' }],
    },
    // Explicit void return — error (should be Promise<Result<void, AppError>>)
    {
      code: `
          class WorkspaceService {
            async delete(ctx: RequestContext, id: string): Promise<void> { return; }
          }
        `,
      errors: [{ messageId: 'missingResult' }],
    },
    // Explicit boolean return — error
    {
      code: `
          class MemberService {
            async update(ctx: RequestContext, input: unknown): Promise<boolean> { return true; }
          }
        `,
      errors: [{ messageId: 'missingResult' }],
    },
  ],
});
