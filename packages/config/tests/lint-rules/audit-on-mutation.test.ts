import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';

import { platformPlugin } from '../../src/eslint-plugin-platform.js';

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

tester.run('audit-on-mutation', platformPlugin.rules['audit-on-mutation'], {
  valid: [
    // Regular method with audit.write call
    {
      code: `
          class WorkspaceService {
            async create(ctx, input) {
              await this.audit.write({ eventType: 'workspace.created' });
              return ok(result);
            }
          }
        `,
    },
    // Observable-wrapped property with audit.write
    {
      code: `
          class WorkspaceService {
            create = observable('WorkspaceService', 'create', obs,
              async (ctx, input) => {
                await this.audit.write({ eventType: 'workspace.created' });
                return ok(result);
              }
            );
          }
        `,
    },
    // Non-mutation method — not checked (e.g., getById, list, find)
    {
      code: `
          class WorkspaceService {
            async getById(ctx, id) { return ok(ws); }
          }
        `,
    },
    // Non-service class — not checked
    {
      code: `
          class WorkspaceHelper {
            async create(notCtx) { /* no audit */ }
          }
        `,
    },
  ],

  invalid: [
    // Regular mutation method without audit.write — warns
    {
      code: `
          class WorkspaceService {
            async create(ctx, input) {
              return ok(result);
            }
          }
        `,
      errors: [{ messageId: 'missingAudit' }],
    },
    // Observable-wrapped mutation without audit.write — warns
    {
      code: `
          class WorkspaceService {
            create = observable('WorkspaceService', 'create', obs,
              async (ctx, input) => {
                return ok(result);
              }
            );
          }
        `,
      errors: [{ messageId: 'missingAudit' }],
    },
    // delete without audit
    {
      code: `
          class UserService {
            async delete(ctx, id) {
              await this.users.hardDelete(id);
              return ok(undefined);
            }
          }
        `,
      errors: [{ messageId: 'missingAudit' }],
    },
  ],
});
