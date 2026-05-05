import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';

import { platformPlugin } from '../../src/eslint-plugin-platform.js';

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

tester.run('require-authz-call', platformPlugin.rules['require-authz-call'], {
  valid: [
    // Method calls authz.authorize — allowed
    {
      code: `
        class WorkspaceService {
          async create(ctx, input) {
            await this.authz.authorize(ctx, 'workspace.create', 'workspace');
            return ok(result);
          }
        }
      `,
    },
    // Read-only prefix (get*) — excluded from rule
    {
      code: `
        class WorkspaceService {
          async getById(ctx, id) {
            return ok(result);
          }
        }
      `,
    },
    // Read-only prefix (find*) — excluded
    {
      code: `
        class WorkspaceService {
          async findBySlug(ctx, slug) {
            return ok(result);
          }
        }
      `,
    },
    // Read-only prefix (list*) — excluded
    {
      code: `
        class MemberService {
          async listForWorkspace(ctx, workspaceId) {
            return ok(result);
          }
        }
      `,
    },
    // Read-only prefix (verify*) — excluded
    {
      code: `
        class AuthService {
          async verifyToken(ctx, token) {
            return ok(result);
          }
        }
      `,
    },
    // Non-service class — not checked
    {
      code: `
        class WorkspaceHelper {
          async create(ctx, input) {
            return ok(result);
          }
        }
      `,
    },
    // Private method — not checked
    {
      code: `
        class WorkspaceService {
          async _create(ctx, input) {
            return ok(result);
          }
        }
      `,
    },
    // Observable-wrapped with authorize — allowed
    {
      code: `
        class WorkspaceService {
          create = observable('WorkspaceService', 'create', obs,
            async (ctx, input) => {
              await this.authz.authorize(ctx, 'workspace.create', 'workspace');
              return ok(result);
            }
          );
        }
      `,
    },
    // Uses .authorize() directly (not this.authz.authorize) — allowed
    {
      code: `
        class MemberService {
          async invite(ctx, input) {
            await authz.authorize(ctx, 'member.invite', 'workspace');
            return ok(result);
          }
        }
      `,
    },
  ],

  invalid: [
    // Non-read-only method without authorize — warns
    {
      code: `
        class WorkspaceService {
          async create(ctx, input) {
            return ok(result);
          }
        }
      `,
      errors: [{ messageId: 'missingAuthz' }],
    },
    // archive method without authorize — warns
    {
      code: `
        class WorkspaceService {
          async archive(ctx, id) {
            return ok(result);
          }
        }
      `,
      errors: [{ messageId: 'missingAuthz' }],
    },
    // transfer method without authorize — warns
    {
      code: `
        class WorkspaceService {
          async transfer(ctx, input) {
            return ok(result);
          }
        }
      `,
      errors: [{ messageId: 'missingAuthz' }],
    },
    // Observable-wrapped mutation without authorize — warns
    {
      code: `
        class MemberService {
          invite = observable('MemberService', 'invite', obs,
            async (ctx, input) => {
              return ok(result);
            }
          );
        }
      `,
      errors: [{ messageId: 'missingAuthz' }],
    },
  ],
});
