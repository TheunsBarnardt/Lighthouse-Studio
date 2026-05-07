# Code Generation Guide (Stage 7)

Stage 7 generates the custom server-side logic your application needs: edge functions, scheduled jobs, event handlers, and integration adapters. The output is TypeScript running in a sandboxed Node.js 22 runtime.

## What gets generated

Stage 7 generates only what auto-generated CRUD cannot handle. For most applications this is 5–15 functions:

| Function type | Examples |
|---------------|----------|
| HTTP functions | Scoring algorithms, complex business logic, multi-step operations |
| Scheduled jobs | Nightly aggregation, weekly digests, cleanup tasks |
| Event handlers | Welcome emails on sign-up, notifications on row change, webhook delivery |
| Integration adapters | Stripe payments, SendGrid emails, Twilio SMS |

Auto-generated CRUD (Stage 4 schema → auto-CRUD) covers: list, get, create, update, delete, search. You don't need custom functions for these.

## Generation flow

### 1. Function inventory

The first step extracts the function inventory — a list of functions to generate, with rationale for each.

The inventory is derived from three sources:
- **UI calls**: every `platform.functions.*()` call in the generated UI requires a function
- **PRD requirements**: "the system should...", "when X happens...", "every night at..." language
- **Integration declarations**: Stripe, SendGrid, etc. mentioned in the PRD

Review the inventory before proceeding. You can:
- Remove functions you don't need
- Add functions the AI missed
- Merge overlapping functions

### 2. Per-function generation

Functions are generated in parallel where dependencies allow. Each function receives:
- Its spec from the inventory
- The database schema (for SDK call types)
- The integration catalog

Each function is validated immediately after generation:
- TypeScript compilation (no `any`, strict types)
- Static analysis (no sandbox escapes, no forbidden imports)
- Permission declaration accuracy (declared permissions match actual SDK calls)

### 3. Code review

The code review UI shows:
- **Inventory panel** — all functions grouped by trigger type (HTTP, schedule, event)
- **Code viewer** — line-numbered TypeScript source
- **Manifest viewer** — trigger configuration, permissions, secrets, rate limits
- **Analysis tab** — static analysis and TypeScript results
- **Reasoning tab** — why this function exists and why this implementation

Review each function. Click **Approve**, or **Regenerate** with feedback.

### 4. Export and deployment

Once satisfied, export the project (ZIP or GitHub) then proceed to Stage 9 (Deployment).

## Generated function shape

All functions follow the same shape:

```typescript
import type { FunctionContext } from '@platform/runtime';
import { z } from 'zod';

const InputSchema = z.object({
  contactId: z.string().uuid(),
  newScore: z.number().min(0).max(100),
});

export async function updateContactScore(rawInput: unknown, ctx: FunctionContext) {
  const input = InputSchema.parse(rawInput);
  const { sdk, logger, secrets } = ctx;

  logger.info('Updating contact score', { contactId: input.contactId });

  const contact = await sdk.data('contacts').where({ id: { _eq: input.contactId } }).one();
  if (!contact) throw new NotFoundError(`Contact ${input.contactId} not found`);

  await sdk.data('contacts').where({ id: { _eq: input.contactId } }).update({ score: input.newScore });

  return { success: true };
}

export const manifest = {
  name: 'update_contact_score',
  trigger: { type: 'http', method: 'POST', path: '/contacts/:id/score' },
  permissions: ['data_table.read', 'data_table.write'],
  secrets: [],
  rateLimit: { requestsPerMinute: 100 },
  timeout: 30000,
  memoryMb: 256,
};
```

Key patterns:
- Validate input with zod before any logic
- Use `ctx.sdk` for all data operations
- Use `ctx.secrets` for API keys (never `process.env`)
- Throw typed errors from `@platform/runtime/errors`
- Export a `manifest` with trigger, permissions, and resource limits

## Integrations

Use integrations via the curated catalog:

```typescript
import { stripe } from '@platform/integrations/stripe';

export async function createCheckout(input, ctx) {
  const session = await stripe(ctx.secrets.stripeApiKey).checkout.sessions.create({
    line_items: input.lineItems,
    mode: 'payment',
    success_url: input.successUrl,
  });
  return { url: session.url };
}
```

Available integrations: Stripe, SendGrid, Postmark, Twilio, OAuth providers, Slack, outbound webhooks, S3-compatible storage.

Configure integration credentials in **Settings → Integrations** before generating functions that use them.

## Sandbox limits

All functions run in a sandboxed process:

| Limit | Default | Maximum |
|-------|---------|---------|
| Execution time | 30 seconds | 5 minutes |
| Memory | 256 MB | 1 GB |
| Outbound network | HTTPS only to allowlisted hosts | — |
| Filesystem | None | tmpfs (if declared) |

Functions that exceed limits are killed and the invocation is recorded as `timeout` or `memory_exceeded`.

## Security rules

The platform enforces:
- No `eval`, `new Function()`, or dynamic code execution
- No `child_process`, `fs`, or raw socket access
- No `process.env` (use `ctx.secrets`)
- No arbitrary npm imports (curated allowlist only)

Violations block the function from progressing to review. One automatic fix attempt is made using the `static-fix` prompt.

## Versioning and rollback

Every generation or regeneration creates a new version. Old versions are preserved indefinitely. To roll back: open the function, click **↩ Rollback**, select the target version.

## Cost

Approximate cost per 10-function project:

| Phase | Model | Est. cost |
|-------|-------|-----------|
| Inventory extraction | haiku | $0.05 |
| 10 HTTP/event functions | opus | $5.00 |
| Static analysis fixes (avg 1) | haiku | $0.02 |
| Permission derivation | haiku | $0.05 |
| **Total** | | **~$5.10** |

Scheduled functions and simple event handlers cost less (~$0.30–0.50 each vs $0.50–1.00 for complex HTTP functions).

## Troubleshooting

See runbooks:
- [Static analysis failures](../runbooks/code-generation-static-analysis-failures.md)
- [Sandbox escape detected](../runbooks/code-generation-sandbox-escape-detected.md)
- [Runtime failures](../runbooks/code-generation-runtime-failures.md)
- [Rolling back a function](../runbooks/code-generation-rollback.md)
- [Integration credentials](../runbooks/code-generation-integration-credentials.md)
- [Rate limit tuning](../runbooks/code-generation-rate-limit-tuning.md)
