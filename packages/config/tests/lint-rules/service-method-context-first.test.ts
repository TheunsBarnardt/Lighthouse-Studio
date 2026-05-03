import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';

import { platformPlugin } from '../../src/eslint-plugin-platform.js';

// Wire RuleTester to vitest so it generates proper test names
RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
});

tester.run('service-method-context-first', platformPlugin.rules['service-method-context-first'], {
  valid: [
    // Regular method with ctx
    {
      code: `
          class WorkspaceService {
            async create(ctx, input) { return null; }
          }
        `,
    },
    // Observable-wrapped property with ctx
    {
      code: `
          class WorkspaceService {
            create = observable('WorkspaceService', 'create', obs,
              async (ctx, input) => { return null; }
            );
          }
        `,
    },
    // Non-service class — not checked
    {
      code: `
          class WorkspaceHelper {
            async create(notCtx, input) { return null; }
          }
        `,
    },
    // Private method — not checked
    {
      code: `
          class WorkspaceService {
            async _create(notCtx, input) { return null; }
          }
        `,
    },
    // Static method — not checked
    {
      code: `
          class WorkspaceService {
            static async create(notCtx, input) { return null; }
          }
        `,
    },
    // Non-async method — not checked
    {
      code: `
          class WorkspaceService {
            create(notCtx, input) { return null; }
          }
        `,
    },
    // Optional ctx param in observable wrapper (background job pattern)
    {
      code: `
          class AuditRetentionService {
            enforceAll = observable('AuditRetentionService', 'enforceAll', obs,
              async (ctx) => { return null; }
            );
          }
        `,
    },
  ],

  invalid: [
    // Regular method missing ctx entirely
    {
      code: `
          class WorkspaceService {
            async create(input) { return null; }
          }
        `,
      errors: [{ messageId: 'missingCtx' }],
    },
    // Regular method with wrong first param name
    {
      code: `
          class WorkspaceService {
            async create(req, input) { return null; }
          }
        `,
      errors: [{ messageId: 'missingCtx' }],
    },
    // Zero-param regular method
    {
      code: `
          class WorkspaceService {
            async create() { return null; }
          }
        `,
      errors: [{ messageId: 'missingCtx' }],
    },
    // Property arrow with wrong first param name
    {
      code: `
          class WorkspaceService {
            create = async (req, input) => { return null; };
          }
        `,
      errors: [{ messageId: 'missingCtx' }],
    },
    // Observable-wrapped with wrong inner function param name
    {
      code: `
          class WorkspaceService {
            create = observable('WorkspaceService', 'create', obs,
              async (req, input) => { return null; }
            );
          }
        `,
      errors: [{ messageId: 'missingCtx' }],
    },
  ],
});
