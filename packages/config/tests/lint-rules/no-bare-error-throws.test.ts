import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';

import { platformPlugin } from '../../src/eslint-plugin-platform.js';

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

tester.run('no-bare-error-throws', platformPlugin.rules['no-bare-error-throws'], {
  valid: [
    // Typed AppError subclass — allowed
    { code: `throw new ValidationError('bad input');` },
    { code: `throw new NotFoundError('workspace', id);` },
    { code: `throw new InternalError('oops');` },
    // Rethrowing a caught value — allowed (not new Error())
    { code: `try { } catch (e) { throw e; }` },
    // Non-Error throw — allowed (rare but valid)
    { code: `throw 'something';` },
  ],

  invalid: [
    // Bare new Error() — forbidden
    {
      code: `throw new Error('something went wrong');`,
      errors: [{ messageId: 'noBareThrow' }],
    },
    // Bare new Error() with no message — forbidden
    {
      code: `throw new Error();`,
      errors: [{ messageId: 'noBareThrow' }],
    },
    // Inside a function — still caught
    {
      code: `
          function doThing() {
            throw new Error('inner error');
          }
        `,
      errors: [{ messageId: 'noBareThrow' }],
    },
  ],
});
