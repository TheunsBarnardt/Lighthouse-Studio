# Service Authoring Guide

_How to add a service method to the platform. Follow this guide every time. The
checklist at the end is what code review uses._

---

## The Canonical Shape

Every public service method follows this order without exception:

```
validate → authorize → precondition → execute → audit → return
```

```typescript
async create(ctx: RequestContext, input: CreateFooInput): Promise<Result<Foo, AppError>> {
  // 1. Validate — zod, at the boundary, always
  const parsed = CreateFooInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(new ValidationError('Invalid foo input',
      parsed.error.issues.map(i => ({ path: i.path.join('.'), message: i.message }))));
  }

  // 2. Authorize — before any database reads that could leak info
  const authResult = await this.authz.authorize(ctx, 'foo.create', 'foo');
  if (authResult.isErr()) {
    await this._logDeny(ctx, 'foo.created', 'foo', null);
    return err(new ForbiddenError(authResult.error.message));
  }

  // 3. Precondition — e.g. uniqueness, parent existence
  const existing = await this.foos.findOne({ slug: { _eq: parsed.data.slug } });
  if (existing.isErr()) return err(new ConflictError(existing.error.message));
  if (existing.value) return err(new ConflictError(`Slug '${parsed.data.slug}' is taken`));

  // 4. Execute — build entity, call repo
  const entity: Foo = { id: uuidv7(), version: 1, ...parsed.data, createdAt: new Date(), ... };
  const createResult = await this.foos.create(entity);
  if (createResult.isErr()) return err(new ConflictError(createResult.error.message));

  // 5. Audit — INSIDE the transaction if one wraps this call
  await this.audit.write({
    eventType: 'foo.created',
    actor: toAuditActor(ctx),
    resource: { type: 'foo', id: entity.id },
    action: 'created',
    outcome: 'success',
    correlationId: ctx.correlationId,
    ...auditMeta(ctx),
  });

  // 6. Return
  return ok(createResult.value);
}
```

**Why this order?**

- **Validate first** — reject malformed input before any I/O. Gives structured
  error details to the caller without hitting the database.
- **Authorize second** — before reading data that could be used to infer
  information about resources the caller shouldn't see.
- **Precondition third** — database-level business rules that require a lookup.
- **Execute** — the actual write.
- **Audit inside execute** — if the operation is wrapped in a transaction, the
  audit event must be inside it. A rolled-back write must not produce an audit
  event claiming it succeeded.
- **Return last** — explicit, readable.

---

## Context Types

Use `RequestContext` for user-initiated operations, `SystemContext` for
background jobs:

```typescript
// user request — has userId, workspaceId, installationRoles, mfaSatisfied
async create(ctx: RequestContext, input: CreateFooInput): Promise<Result<Foo, AppError>>

// background job — has subsystem, correlationId, no userId
async runRetentionSweep(ctx: SystemContext): Promise<Result<void, AppError>>
```

The `_kind` discriminator catches calling the wrong context type at compile
time. `SystemContext` callers bypass user-level authorization; they have implied
system authority. Never use `SystemContext` from an HTTP handler.

---

## Errors

Always return a typed `AppError` subclass. Never throw bare `Error`.

| Situation                             | Error class               |
| ------------------------------------- | ------------------------- |
| Input failed validation               | `ValidationError`         |
| User not authenticated                | `AuthenticationError`     |
| User authenticated but not authorized | `ForbiddenError`          |
| Entity not found                      | `NotFoundError(type, id)` |
| Duplicate / version mismatch          | `ConflictError`           |
| Feature not available on this adapter | `NotSupportedError`       |
| External API failed                   | `ExternalServiceError`    |
| Unclassified internal failure         | `InternalError`           |

Catch stray throws from deep helpers:

```typescript
try {
  const x = riskyUtility();
  return ok(x);
} catch (e) {
  return err(new InternalError('riskyUtility failed', { cause: e }));
}
```

---

## Transactions

Wrap operations that span two or more repository writes:

```typescript
async transfer(ctx: RequestContext, input: TransferInput): Promise<Result<Foo, AppError>> {
  return this.uow.run(async (_tx) => {
    // All repo calls here are part of one atomic unit
    const updated = await this.foos.update(input.id, { ownerId: input.newOwnerId });
    if (updated.isErr()) return err(new NotFoundError('foo', input.id));

    // Audit INSIDE the transaction — rolled back on failure
    await this.audit.write({ ... });

    return ok(updated.value);
  });
}
```

Rules:

- Never call external services (HTTP, email, AI) inside a transaction.
- Authorization runs **outside** the transaction unless it reads data that must
  be consistent with the transaction.
- Long transactions (> 30s) emit a warning; > 5 min emit an error.

---

## Idempotency

For operations that must be safe to retry (email, deploy, charge), pass
`withIdempotency` at the method level:

```typescript
async create(ctx: RequestContext, input: CreateFooInput): Promise<Result<Foo, AppError>> {
  return withIdempotency(
    {
      repo: this.idempotencyRepo,
      operation: 'FooService.create',
      workspaceId: ctx.workspaceId ?? null,
      idempotencyKey: ctx.idempotencyKey,
      id: () => uuidv7(),
    },
    async () => {
      // ... normal method body ...
    }
  );
}
```

Only wrap operations where double-execution would cause visible harm. Read
operations and cheap idempotent writes don't need it.

---

## Workspace Scoping

Most data is workspace-scoped. Use `bindToContext` from `@platform/core` to
auto-inject `workspace_id` into every query:

```typescript
const scopedFoos = bindToContext(this.foos, ctx);
// Now every findOne/findMany/update call automatically filters by workspaceId.
```

If `ctx.workspaceId` is absent when it shouldn't be:

```typescript
if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());
```

---

## Observability

Wrap service methods with `observable()` when the service is constructed:

```typescript
export class FooService {
  readonly create: typeof this._create;

  constructor(/* ... */, obs: ObservabilityDeps) {
    this.create = observable('FooService', 'create', obs, this._create.bind(this));
  }

  private async _create(ctx: RequestContext, input: CreateFooInput): Promise<Result<Foo, AppError>> {
    // ...
  }
}
```

Or apply it at the composition root:

```typescript
const fooService = new FooService(...);
fooService.create = observable('FooService', 'create', obs, fooService.create.bind(fooService));
```

The wrapper automatically produces a trace span, log entries at debug/info/error,
and a `platform_service_method_duration_ms` histogram metric per call.

---

## Testing Pattern

**Unit tests** — fast, in-memory, no real database:

```typescript
import { createInMemoryAudit, createInMemoryAuthz, createInMemoryLogger, createInMemoryRepo, makeUserContext } from '@platform/core/testing';

function makeService(opts?: { denyAll?: boolean }) {
  const adapters = {
    authz: createInMemoryAuthz({ deny: opts?.denyAll }),
    foos: createInMemoryRepo<Foo>(),
    audit: createInMemoryAudit(),
    logger: createInMemoryLogger(),
  };
  return { service: new FooService(...adapters), adapters };
}

it('creates a foo', async () => {
  const { service } = makeService();
  const result = await service.create(makeUserContext(), { name: 'bar' });
  expect(result.isOk()).toBe(true);
});
```

**Error code assertions** — assert on `.code`, never on `.message`:

```typescript
expect(result._unsafeUnwrapErr().code).toBe('VALIDATION');
```

**Audit assertions**:

```typescript
expect(adapters.audit.events).toContainEqual(expect.objectContaining({ eventType: 'foo.created', outcome: 'success' }));
```

---

## Adding a Service Method — Checklist

```
[ ] Define zod input schema in the service file
[ ] Method signature: async fn(ctx: RequestContext | SystemContext, input: Input): Promise<Result<Output, AppError>>
[ ] Step 1: validate input with safeParse → ValidationError on failure
[ ] Step 2: authorize with authz.authorize(ctx, 'resource.action', 'resource')
[ ] Step 3: preconditions (uniqueness, parent exists, version ok)
[ ] Step 4: execute — call repositories, build entities
[ ] Step 5: audit.write() for state changes — inside transaction if applicable
[ ] Step 6: return ok(result)
[ ] If spanning multiple writes: wrap in uow.run(async (tx) => { ... })
[ ] Audit is INSIDE the transaction block if one exists
[ ] Audit denied outcomes via _logDeny()
[ ] Add unit tests covering: happy path, validation failure, authorization failure,
    conflict/not-found, idempotency if applicable
[ ] Assert errors by .code, not .message
[ ] Audit event catalog updated if new event types introduced
[ ] Personal data registry updated if new PII fields stored
[ ] Permissions vocabulary updated in docs/contracts/permissions.md
```

---

## Adding a New Service — Quick Start

```bash
pnpm new-service Foo
```

This generates:

```
packages/core/src/services/foo.service.ts       # service stub with canonical shape
packages/core/src/services/foo.service.test.ts   # test stub
# updates packages/core/src/index.ts
```

Replace the stub body with the real implementation, fill in the constructor
deps, and wire the service into the composition root.

---

## Anti-Patterns

| Anti-pattern                               | Why it's wrong                                                                   |
| ------------------------------------------ | -------------------------------------------------------------------------------- |
| Authorize before validate                  | Leaks that a field is invalid to unauthorized callers; also wrong order per spec |
| Skip validation "TypeScript already typed" | TypeScript types are erased at runtime; zod validates at runtime                 |
| Skip authorization "this is internal"      | Inner service callers still authorize; each service is its own boundary          |
| Audit after transaction commit             | Rolled-back writes produce lying audit entries                                   |
| `throw new Error(...)`                     | Use typed AppError; ESLint rule catches this                                     |
| Checking `error.message.includes(...)`     | Check `error.code` instead; messages are for humans                              |
| Multiple inputs as separate params         | Combine into an input object; signature is always `(ctx, input)`                 |
| Calling external services inside a tx      | Blocks the tx; use prepare-then-commit pattern                                   |
| State on service instances                 | Services are stateless; state is in ctx, DB, or injected deps                    |
