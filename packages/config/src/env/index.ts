import type { ServerEnv } from './schema.js';

import { serverEnvSchema } from './schema.js';

export type { ClientEnv, ServerEnv } from './schema.js';
export { clientEnvSchema, serverEnvSchema } from './schema.js';

let _env: ServerEnv | undefined;

/**
 * Returns the validated server environment object.
 * Parses process.env on first call and caches the result. Throws on misconfiguration,
 * so the process exits immediately with a clear error rather than failing silently later.
 *
 * Workers call this at startup. The web app calls it inside server components / API routes.
 * Never call it in client-side code — use NEXT_PUBLIC_* vars directly.
 */
export function getEnv(): ServerEnv {
  if (_env) return _env;

  const result = serverEnvSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.flatten();
    const lines: string[] = [
      '',
      '❌  Invalid environment configuration — the process cannot start.',
      '',
    ];

    const fieldErrors = errors.fieldErrors as Record<string, string[] | undefined>;
    for (const [field, messages] of Object.entries(fieldErrors)) {
      if (messages && messages.length > 0) {
        lines.push(`  ${field}: ${messages.join(', ')}`);
      }
    }

    if (errors.formErrors.length > 0) {
      lines.push('', '  Cross-field errors:');
      for (const msg of errors.formErrors) {
        lines.push(`    • ${msg}`);
      }
    }

    lines.push('', '  Check .env.example for required variables and their documentation.', '');

    // Using process.stderr directly is intentional here: this is the env package itself,
    // and structured logging is not yet available at this point in startup.
    process.stderr.write(lines.join('\n'));
    process.exit(1);
  }

  _env = result.data;
  return _env;
}

/**
 * Resets the cached env. Only for use in tests.
 */
export function _resetEnvForTesting(): void {
  _env = undefined;
}
