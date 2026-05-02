# Objective 8: Service Layer Architecture

**Status:** Ready for development
**Prerequisites:** Objectives 1, 1.5, 2, 3, 4 family, 5, 6, 7 complete
**Blocks:** Every feature objective. The patterns codified here are how every feature is built going forward.

---

## 1. Purpose

Formalize the service-layer patterns that have been emerging organically across earlier objectives — `RequestContext` propagation, repository binding, audit emission, error handling, transaction management — into reusable, enforced, documented conventions.

The risk this prevents: every feature author independently reinventing how to write a service method, with subtle inconsistencies that compound into a fractured codebase. By the time the data management module ships, there could be five different ways to do the same thing across a dozen services. Each "way" works, but together they're a maintenance nightmare and a security review hazard.

This objective produces no user-visible features. It produces the **service layer conventions** as code, documentation, lint rules, and code generators. It locks in "this is how a service is built" so every later feature follows the same pattern. The pattern itself becomes the codebase's most important architectural property — more important than any single feature.

---

## 2. Scope

### In Scope

- The canonical service method shape (the one pattern every method follows)
- `RequestContext` and `SystemContext` types finalized (referenced loosely in earlier objectives; here they are locked)
- The composition pattern for service dependencies (constructor injection, no service locator)
- Transaction management at the service layer
- Error model and exception boundary discipline
- Validation at service boundaries (input validation; output is internally trusted)
- The `withAudit` and `withTransaction` helpers that wrap operations
- Service factory and registry for the DI container
- Linter rules that catch deviations from the pattern
- A reference service implementation that other services should mirror
- Code generator for new services (scaffolds the boilerplate correctly)
- Service-level testing patterns: how unit tests, integration tests, and contract tests are organized
- Documentation: the service author's guide
- ADRs

### Out of Scope (Belongs to Later Objectives)

- The actual feature services (those land with each feature objective)
- HTTP / API layer (separate concern; the service layer doesn't know about HTTP)
- The web UI's data-fetching patterns (separate, on top of API)
- Background workers' specific job handlers (those use the service layer; how each job is structured is per-feature)
- Service-to-service communication patterns (in-process today; cross-process deferred)

---

## 3. Locked Decisions

| Decision            | Choice                                                                                                                                                         | Rationale                                                                |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Service shape       | Class with constructor-injected dependencies; methods take `RequestContext` (or `SystemContext`) as first param                                                | Standard, testable, explicit                                             |
| Method signature    | `async fn(ctx, input): Promise<Result<Output, AppError>>`                                                                                                      | Result-typed; ctx is mandatory; errors are values                        |
| Validation          | zod schemas at the service boundary; never trust unvalidated input                                                                                             | Defense in depth                                                         |
| Authorization       | First step in every method (after validation); via `AuthorizationPort`                                                                                         | Established in Objective 6                                               |
| Transactions        | Service methods open transactions only when they span multiple repository calls; otherwise no transaction wrapper                                              | Avoids unnecessary overhead                                              |
| Audit emission      | Every state-changing method emits at least one audit event                                                                                                     | Established in Objective 7                                               |
| Error model         | Typed error classes from `@platform/shared/errors`; no bare Errors                                                                                             | Consistency, programmatic handling                                       |
| DI container        | Manual composition root from Objective 1.5; services constructed once, reused                                                                                  | Explicit, type-safe, no magic                                            |
| Service tests       | Unit tests with in-memory adapters; integration tests with real adapters; contract tests via the conformance suite                                             | Three layers; each catches different bugs                                |
| Code generator      | A `pnpm new-service <name>` command scaffolds a complete service                                                                                               | Removes friction; enforces convention                                    |
| Linter rules        | Custom ESLint rules: every public method has `ctx` as first param; every public method returns `Result<T, AppError>`; every state change has an audit emission | Mechanical enforcement                                                   |
| Service location    | `packages/core/src/services/<domain>.service.ts`                                                                                                               | Standard layout                                                          |
| Naming              | `<Domain>Service` (e.g., `WorkspaceService`); methods are verbs (`create`, `update`, `archive`)                                                                | Standard                                                                 |
| Cross-service calls | Allowed; circular dependencies forbidden (verified by dependency-cruiser)                                                                                      | Common; the dep graph stays a DAG                                        |
| Concurrency         | Optimistic locking via repository layer (Objective 4); pessimistic locking via explicit `withLock` wrapper for serialization needs                             | Mostly optimistic; pessimistic is rare and explicit                      |
| Idempotency         | Mutating methods accept optional `idempotencyKey`; duplicate keys within window return cached result                                                           | Standard pattern; required for safe retry                                |
| Pagination          | Returned via `PaginatedResult<T>` from the repository; service methods pass it through                                                                         | Established in Objective 4                                               |
| Retries             | Service methods don't retry; callers retry with explicit backoff                                                                                               | Service methods are atomic units; retry policy is an operational concern |

---

## 4. The Canonical Service Method

This is the shape every service method follows:

```typescript
// packages/core/src/services/workspace.service.ts

import { z } from 'zod';
import { ResultAsync, ok, err, errAsync } from 'neverthrow';
import { type RequestContext, type AppError, ConflictError, NotFoundError, ValidationError } from '@platform/shared';
import { type LoggerPort } from '@platform/ports-observability';
import { type AuthorizationPort } from '@platform/ports-authorization';
import { type AuditPort } from '@platform/ports-audit';
import { type RepositoryPort } from '@platform/ports-persistence';
import { type Workspace } from '../domain/workspace';

const createWorkspaceInputSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/),
  description: z.string().max(4000).optional(),
});
type CreateWorkspaceInput = z.infer<typeof createWorkspaceInputSchema>;

export class WorkspaceService {
  constructor(
    private readonly authz: AuthorizationPort,
    private readonly workspaces: RepositoryPort<Workspace>,
    private readonly members: RepositoryPort<WorkspaceMember>,
    private readonly audit: AuditPort,
    private readonly logger: LoggerPort,
  ) {}

  async create(ctx: RequestContext, input: CreateWorkspaceInput): Promise<Result<Workspace, AppError>> {
    // 1. Validate input
    const parsed = createWorkspaceInputSchema.safeParse(input);
    if (!parsed.success) {
      return err(new ValidationError('Invalid workspace input', parsed.error.flatten()));
    }

    // 2. Authorize
    const authResult = await this.authz.authorize(ctx, 'workspace.create', 'workspace');
    if (authResult.isErr()) {
      // Authorization failures audit as 'denied' from inside AuthorizationPort already.
      return err(authResult.error);
    }

    // 3. Pre-condition: slug uniqueness within installation
    const existing = await this.workspaces.findOne({ slug: { _eq: parsed.data.slug } });
    if (existing.isErr()) return err(existing.error);
    if (existing.value !== null) {
      return err(new ConflictError(`Workspace slug "${parsed.data.slug}" already exists`));
    }

    // 4. Execute (single repository call; no transaction needed)
    const workspace = await this.workspaces.create({
      ...parsed.data,
      ownerUserId: ctx.userId,
      createdBy: ctx.userId,
      // ... standard columns from the helper
    });
    if (workspace.isErr()) return err(workspace.error);

    // 5. Side effect: add the creator as workspace owner member
    const memberResult = await this.members.create({
      workspaceId: workspace.value.id,
      userId: ctx.userId,
      status: 'active',
      acceptedAt: new Date(),
      // The first member's role assignment happens via a separate atomic step; see notes
    });
    if (memberResult.isErr()) {
      // Compensate? In a transactional implementation, we'd rollback. Without:
      // the workspace exists but has no owner. Audit and return error.
      this.logger.error('workspace.create.member_creation_failed', {
        workspaceId: workspace.value.id,
        error: memberResult.error,
      });
      return err(memberResult.error);
    }

    // 6. Audit
    await this.audit.write({
      eventType: 'workspace.created',
      workspaceId: workspace.value.id,
      actor: { kind: 'user', id: ctx.userId },
      resource: { type: 'workspace', id: workspace.value.id },
      action: 'create',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: { name: parsed.data.name, slug: parsed.data.slug },
    });

    // 7. Return
    return ok(workspace.value);
  }
}
```

This shape — validate, authorize, precondition, execute, audit, return — is the contract. Every public service method follows it. The patterns it expresses:

- `ctx` is the first parameter, always
- Returns `Result<T, AppError>`, never throws
- zod validation at the boundary
- Authorization before action
- Repository operations return `Result`, propagated via early-return
- Audit emission as a deliberate step, not a side effect
- All errors are typed; bare Error never escapes

When the operation spans multiple repository calls that must be atomic, the same shape adds a transaction wrapper.

---

## 5. Transaction Management

Multi-step operations use `withTransaction`:

```typescript
async transferOwnership(
  ctx: RequestContext,
  workspaceId: string,
  newOwnerId: string,
): Promise<Result<Workspace, AppError>> {
  return this.uow.transaction(async (tx) => {
    // All repository calls inside this scope use the transaction
    const workspaces = tx.repository<Workspace>('workspaces');
    const members = tx.repository<WorkspaceMember>('workspace_members');

    const ws = await workspaces.findById(workspaceId);
    if (ws.isErr()) return err(ws.error);
    if (!ws.value) return err(new NotFoundError('workspace', workspaceId));

    // Authorize with the original ctx; transactions don't change identity
    const authz = await this.authz.authorize(ctx, 'workspace.transfer', 'workspace', { resourceId: workspaceId });
    if (authz.isErr()) return err(authz.error);

    // Verify newOwner is a member
    const newOwnerMembership = await members.findOne({
      workspaceId: { _eq: workspaceId },
      userId: { _eq: newOwnerId },
    });
    if (newOwnerMembership.isErr()) return err(newOwnerMembership.error);
    if (!newOwnerMembership.value) return err(new ValidationError('New owner must be a workspace member'));

    // Update workspace
    const updated = await workspaces.update(workspaceId, { ownerUserId: newOwnerId });
    if (updated.isErr()) return err(updated.error);

    // Audit (the audit write is part of the transaction; if anything fails, the audit is rolled back too)
    await this.audit.write({
      eventType: 'workspace.transferred',
      workspaceId,
      actor: { kind: 'user', id: ctx.userId },
      resource: { type: 'workspace', id: workspaceId },
      action: 'transfer',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: { previousOwnerId: ws.value.ownerUserId, newOwnerId },
    });

    return ok(updated.value);
  });
}
```

Rules:

- Transactions wrap operations that span 2+ repository writes
- The audit emission is INSIDE the transaction so a rolled-back operation produces no audit (otherwise we'd lie about what happened)
- Authorization is done OUTSIDE the transaction in the caller, OR inside if the authorization itself touches the database in ways that benefit from transactional consistency
- Long-running transactions (> 5 seconds) emit warnings; > 30s emit errors
- Transactions don't span async boundaries that could block (no calls to external services inside; if needed, use a different pattern: prepare-then-commit with idempotency)

---

## 6. The Two Context Types

**`RequestContext`** is for user-initiated operations:

```typescript
export interface RequestContext {
  readonly _kind: 'user' | 'service_account';
  userId: string;
  workspaceId?: string; // optional for installation-scoped operations
  installationRoles: string[];
  correlationId: string;
  ipAddress?: string;
  userAgent?: string;
  mfaSatisfied: boolean;
  idempotencyKey?: string;
}
```

**`SystemContext`** is for non-user operations: scheduled jobs, system migrations, background tasks:

```typescript
export interface SystemContext {
  readonly _kind: 'system';
  workspaceId?: string;
  correlationId: string;
  jobId?: string;
  triggeredBy?: 'scheduler' | 'event' | 'migration' | 'manual_admin';
}
```

The `_kind` discriminator means TypeScript can require the right context for the right operation. Service methods that should only be callable by users have `RequestContext` parameter; methods that are exclusively background-job-callable have `SystemContext`. Methods that work for both have a `Context = RequestContext | SystemContext` union and handle each case explicitly.

This is what prevents a clever future bug like "a background job calls a service method designed only for authenticated users and bypasses authorization." The type system catches it.

---

## 7. Service Composition

Services are constructed once, at startup, by the composition root from Objective 1.5. They live for the lifetime of the process. They are stateless (no per-request state on the instance — that's what `ctx` is for).

```typescript
// packages/composition/src/compose-services.ts

export function composeServices(adapters: PlatformContainer): ServiceContainer {
  // Logger gets passed everywhere; create a child per service for context
  const baseLogger = adapters.logger;

  const workspaceService = new WorkspaceService(adapters.authorization, adapters.persistence.repositories.workspaces, adapters.persistence.repositories.members, adapters.audit, baseLogger.child({ service: 'WorkspaceService' }));

  const memberService = new MemberService(adapters.authorization, adapters.persistence.repositories.members, adapters.persistence.repositories.invitations, adapters.email, adapters.audit, baseLogger.child({ service: 'MemberService' }));

  // ... and so on

  return {
    workspaces: workspaceService,
    members: memberService,
    // ...
  };
}
```

The container is constructed once. Routes / job handlers / API endpoints reference services from the container.

**Service factory pattern (alternative for testing):**

For testability, services are also exposed as factory functions:

```typescript
export function createWorkspaceService(deps: WorkspaceServiceDeps): WorkspaceService {
  return new WorkspaceService(/* ... */);
}
```

Tests construct services with mocked dependencies via the factory. The constructor is the production path; the factory is the testing path. They produce equivalent results.

---

## 8. Error Handling and the Error Model

Every error in the platform is a member of a typed hierarchy:

```typescript
// packages/shared/src/errors/index.ts

/** Abstract base for all platform errors. Never thrown directly. */
export abstract class AppError extends Error {
  abstract readonly code: string;
  readonly cause?: unknown;
  readonly metadata: Readonly<Record<string, unknown>>;

  constructor(message: string, opts?: { cause?: unknown; metadata?: Record<string, unknown> }) {
    super(message);
    this.name = this.constructor.name;
    this.cause = opts?.cause;
    this.metadata = Object.freeze({ ...(opts?.metadata ?? {}) });
  }

  /** HTTP status code mapping (used at the API layer). */
  abstract get statusCode(): number;
}

export class ValidationError extends AppError {
  readonly code = 'VALIDATION_ERROR';
  get statusCode() {
    return 400;
  }
}

export class AuthenticationError extends AppError {
  readonly code = 'AUTHENTICATION_ERROR';
  get statusCode() {
    return 401;
  }
}

export class AuthorizationError extends AppError {
  readonly code = 'AUTHORIZATION_ERROR';
  get statusCode() {
    return 403;
  }
}

export class NotFoundError extends AppError {
  readonly code = 'NOT_FOUND';
  get statusCode() {
    return 404;
  }

  constructor(
    public readonly resourceType: string,
    public readonly resourceId: string,
  ) {
    super(`${resourceType} not found: ${resourceId}`);
  }
}

export class ConflictError extends AppError {
  readonly code = 'CONFLICT';
  get statusCode() {
    return 409;
  }
}

export class RateLimitError extends AppError {
  readonly code = 'RATE_LIMIT_EXCEEDED';
  get statusCode() {
    return 429;
  }
}

export class ExternalServiceError extends AppError {
  readonly code = 'EXTERNAL_SERVICE_ERROR';
  get statusCode() {
    return 502;
  }
}

export class TimeoutError extends AppError {
  readonly code = 'TIMEOUT';
  get statusCode() {
    return 504;
  }
}

export class NotSupportedError extends AppError {
  readonly code = 'NOT_SUPPORTED';
  get statusCode() {
    return 501;
  }
}

export class InternalError extends AppError {
  readonly code = 'INTERNAL_ERROR';
  get statusCode() {
    return 500;
  }
}
```

**Rules:**

- Service methods return `Result<T, AppError>` — never throw
- Internal helpers may throw, but those throws are caught at service-method boundaries and converted to typed errors
- Never throw bare `Error`. Use the specific class. If none fits, that's a signal to add a new error type, not to throw a bare one
- The error's `code` is stable and machine-readable; tests assert on `code`, not `message`
- The `message` is human-readable; localized at the API layer if needed
- The `metadata` carries structured details (validation errors, fields, constraint names) for the UI to use
- The `cause` chain is preserved for debugging; the original driver error is in `cause` of a `PersistenceError`, etc.

**Conversion pattern at service boundary:**

```typescript
async someOperation(ctx, input) {
  try {
    // imperative code that may throw...
    const result = await externalCall();
    return ok(transform(result));
  } catch (err) {
    if (err instanceof KnownError) {
      return err(new InternalError('Operation failed', { cause: err }));
    }
    throw err; // re-throw unknown errors to be caught higher up
  }
}
```

In practice, throws are rare — repository ports return `Result`; identity ports return `Result`; only utility helpers (string parsing, etc.) throw, and those are wrapped at use site.

---

## 9. Validation at Service Boundaries

Every service method's input is validated with a zod schema as the first step. Why:

- Input from API/web/worker can never be trusted as type-safe
- TypeScript types are erased at runtime; zod validates at runtime
- Schemas are declarative and live alongside the service code
- Validation errors carry structured metadata (which field failed, why)

Schemas are written once and reused:

- The service method validates input
- The API layer auto-generates OpenAPI from the schema
- The client SDK auto-generates types from the schema

Convention: input schemas live next to the service in `packages/core/src/services/<domain>/schemas.ts`. They're exported so other layers (API, tests) reuse them.

---

## 10. Observability in Services

Every service method:

- Has its own span via the `TracerPort` (auto-instrumented at the method level via a decorator or higher-order wrapper)
- Logs at debug on entry, debug or info on success, warn on validation failure, error on internal failure
- Records metrics: `platform_service_method_duration_seconds{service, method, outcome}`
- Includes correlation ID in every log line

A higher-order wrapper makes this mechanical:

```typescript
// packages/core/src/observability/observable.ts

export function observable<T extends (...args: any[]) => Promise<any>>(service: string, method: string, fn: T): T {
  return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    const ctx = args[0] as RequestContext | SystemContext;
    const span = tracer.startSpan(`${service}.${method}`);
    const start = performance.now();

    try {
      logger.debug(`${service}.${method}.entry`, { correlationId: ctx.correlationId });
      const result = await fn(...args);

      const duration = performance.now() - start;
      const outcome = result.isOk() ? 'success' : 'failure';

      metrics.histogram('platform_service_method_duration_seconds').record(duration / 1000, {
        service,
        method,
        outcome,
      });

      if (result.isOk()) {
        logger.debug(`${service}.${method}.success`, { correlationId: ctx.correlationId });
      } else {
        const err = result.error;
        if (err.code === 'VALIDATION_ERROR' || err.code === 'AUTHORIZATION_ERROR') {
          logger.info(`${service}.${method}.expected_error`, {
            correlationId: ctx.correlationId,
            code: err.code,
          });
        } else {
          logger.error(`${service}.${method}.error`, {
            correlationId: ctx.correlationId,
            err,
          });
        }
      }

      return result;
    } catch (err) {
      span.recordException(err as Error);
      logger.fatal(`${service}.${method}.unhandled`, { err });
      throw err;
    } finally {
      span.end();
    }
  }) as T;
}
```

Service classes apply this wrapper to all public methods, either via a decorator (TS supports them) or via the factory function. The boilerplate is gone; the discipline remains.

---

## 11. Idempotency

Mutating service methods accept an optional `idempotencyKey` in the context (or input). When provided:

1. The service hashes the operation + key
2. Looks up an `idempotency_records` table for a matching key
3. If found and recent (within window): returns the cached result without re-executing
4. If not found: executes; records the result keyed by hash
5. If found but expired: a new execution proceeds (treated as a fresh request)

The window is configurable per operation type; default is 24 hours.

This makes safe retry possible: a client (web, worker) can retry the same operation with the same key and get the same result without double-executing. Especially important for operations that have side effects (sending emails, deploying, charging).

The `idempotency_records` table is workspace-scoped, retention-bound (cleaned up by the retention enforcement job). Schema:

```typescript
idempotency_records: {
  ...standardColumns,
  workspaceId: uuid?,
  operation: string(255),
  keyHash: char(64),
  resultJson: json,
  expiresAt: timestamptz,
}
unique: [keyHash, operation]
```

---

## 12. Service Tests

Three layers of tests per service:

**Unit tests** — fast, isolated, run in milliseconds:

- Service constructed with in-memory adapters (in-memory repositories, in-memory audit, in-memory authorization that always allows or denies as configured)
- Tests every code path, including edge cases
- One test file per service

**Integration tests** — slower, real adapters:

- Service constructed against actual database (Postgres in CI, but tests run against all three adapters in matrix mode)
- Real audit writes, real authorization, real transactions
- Tests cross-cutting concerns: actual transaction rollback, actual audit chain, actual permission evaluation
- Slower but catches bugs unit tests miss

**Contract tests** — runs the conformance suite if applicable:

- For services that wrap a port (e.g., the auth service wrapping IdentityProviderPort), the conformance suite from earlier objectives is the contract test

A test for `WorkspaceService.create` looks like:

```typescript
describe('WorkspaceService.create', () => {
  // Unit tests
  describe('with in-memory adapters', () => {
    let service: WorkspaceService;
    let adapters: TestAdapters;

    beforeEach(() => {
      adapters = createInMemoryAdapters();
      service = createWorkspaceService(adapters);
    });

    it('creates a workspace with valid input', async () => {
      const ctx = makeUserContext({ userId: 'u1' });
      const result = await service.create(ctx, { name: 'Test', slug: 'test' });
      expect(result.isOk()).toBe(true);
      // ... assertions
    });

    it('rejects invalid slug', async () => {
      const ctx = makeUserContext({ userId: 'u1' });
      const result = await service.create(ctx, { name: 'Test', slug: 'Test With Spaces' });
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('VALIDATION_ERROR');
    });

    it('emits an audit event on success', async () => {
      const ctx = makeUserContext({ userId: 'u1' });
      await service.create(ctx, { name: 'Test', slug: 'test' });
      expect(adapters.audit.events).toContainEqual(
        expect.objectContaining({
          eventType: 'workspace.created',
        }),
      );
    });
  });

  // Integration tests
  describe('with real adapters (matrix)', () => {
    forEachDatabase((adapter) => {
      it('creates and persists a workspace', async () => {
        // ...
      });

      it('rolls back on transaction failure', async () => {
        // ...
      });
    });
  });
});
```

---

## 13. Service Author's Guide

A document at `docs/contracts/service-authoring.md` is the canonical reference for "how to add a new service method." It's structured as a checklist:

```markdown
## Adding a Service Method — Checklist

1. [ ] Define the input zod schema in `packages/core/src/services/<domain>/schemas.ts`
2. [ ] Add the method to the service class with the correct context parameter type
3. [ ] Validate input first (zod safeParse → ValidationError on failure)
4. [ ] Call `authorize()` for the appropriate (action, resource) tuple
5. [ ] If the operation spans multiple writes: wrap in `uow.transaction(...)`
6. [ ] Execute the operation, propagating Results via early return on err
7. [ ] Emit an audit event for state changes (always within the transaction if there is one)
8. [ ] Return `ok(result)`
9. [ ] Wrap the method with `observable()` (or rely on the class decorator)
10. [ ] Add unit tests with in-memory adapters covering happy path, validation failures, authorization failures, conflict cases, edge cases
11. [ ] Add integration tests against real adapters in matrix mode
12. [ ] Update the audit event catalog if introducing a new event type
13. [ ] Update the personal data registry if storing PII
14. [ ] Document any non-obvious decisions in code comments
15. [ ] Code review against this checklist
```

This is the document feature authors read before adding service methods. Following it produces correct, consistent code.

---

## 14. Linter Rules

Custom ESLint rules in `packages/config/eslint.config.mjs`:

- **`platform/service-method-context-first`**: every public async method on a class ending in `Service` has its first parameter typed as `RequestContext | SystemContext` (or one of those alone)
- **`platform/service-method-returns-result`**: every public async method on a Service returns `Promise<Result<...>>`
- **`platform/no-bare-error-throws`**: `throw new Error(...)` is forbidden in `packages/core` (use a typed AppError)
- **`platform/no-direct-adapter-import`**: services in `packages/core` can only import from `@platform/ports-*`, never from `@platform/adapters-*`
- **`platform/audit-on-mutation`**: heuristic — methods named `create|update|delete|archive|restore|approve|reject` should call `audit.write(...)` somewhere in the body. Soft warning, not hard fail.

These rules are tested with a few violation cases in `packages/config/tests/lint-rules/`.

---

## 15. Code Generator

`pnpm new-service <name>` scaffolds a complete service:

```
$ pnpm new-service Project
✓ Created packages/core/src/services/project.service.ts
✓ Created packages/core/src/services/project.service.test.ts
✓ Created packages/core/src/services/project/schemas.ts
✓ Updated packages/core/src/services/index.ts
✓ Updated packages/composition/src/compose-services.ts (added ProjectService composition)
✓ Reminder: add the relevant resources to the permission vocabulary in docs/contracts/permissions.md
```

The generated service has a stub method (`create`) demonstrating the canonical shape. The author replaces it with their actual operations.

The generator is implemented in `scripts/new-service.mts` (TypeScript via `tsx`).

---

## 16. Concurrency: When to Use Pessimistic Locking

99% of the time, the optimistic locking from Objective 4 is enough: every entity has a version; updates check the version; concurrent conflicts return `ConflictError` and the caller retries.

For the rare cases that need explicit serialization — e.g., generating a sequence number where two concurrent generators must produce different values — services use `withLock`:

```typescript
const result = await this.locks.withLock(`workspace:${workspaceId}:invoice-sequence`, async () => {
  // serialized operation
});
```

Implementation per database:

- **Postgres**: advisory locks (`pg_try_advisory_lock`)
- **MSSQL**: `sp_getapplock`
- **Mongo**: a "locks" collection with TTL documents

The lock is held for the operation's duration; held longer than 30s emits a warning; longer than 5min emits an error.

This pattern is rarely needed but available. Documented in the service author's guide as "for the case where optimistic isn't enough."

---

## 17. Implementation Order

1. **Lock down `RequestContext` and `SystemContext`** types in `packages/shared`.

2. **Finalize the error hierarchy** in `packages/shared/errors/index.ts`.

3. **Build the `observable()` higher-order wrapper** for service methods.

4. **Build the `withLock` helper** with adapter implementations per database.

5. **Build the idempotency infrastructure** (table, helper).

6. **Implement custom ESLint rules** and verify they catch deviations.

7. **Build the `pnpm new-service` generator.**

8. **Refactor existing services** built in earlier objectives (WorkspaceService, MemberService from Objective 6; AuthService from Objective 5) to follow the canonical pattern strictly. Some of them already roughly do; this pass makes them rigorous.

9. **Write the service author's guide.**

10. **Set up the unit-test and integration-test patterns** in `packages/core/tests/`.

11. **Establish the matrix integration tests** that run service-level integration tests against all three database adapters.

12. **Write ADRs.**

13. **Verify Definition of Done.**

---

## 18. ADRs to Write

- **ADR-0076: The Canonical Service Method Shape** — validate, authorize, precondition, execute, audit, return; why this order; what each step prevents
- **ADR-0077: Result-Typed Service Returns** — Promise<Result<T, AppError>>; rejecting throws across service boundaries
- **ADR-0078: Constructor Injection over Service Locator** — explicit dependencies; testability
- **ADR-0079: zod for Service Boundary Validation** — runtime validation; TypeScript erasure; OpenAPI generation
- **ADR-0080: Observable Wrapper as Mechanical Discipline** — automatic spans/logs/metrics on every service method
- **ADR-0081: Idempotency at the Service Layer** — when, how, where the table lives
- **ADR-0082: Pessimistic Locking via withLock** — the rare case; how it's exposed

---

## 19. Verification Steps

1. **A new service generated by the generator compiles, has tests, and follows the canonical shape.**

2. **Linter rules catch a violation** — write a service method without `ctx`; lint fails. With bare throw; lint fails. Importing an adapter directly; lint fails.

3. **A service with multiple repository writes uses `withTransaction`**; failure mid-operation rolls back all writes including the audit event.

4. **A service method with idempotency key returns the same result on retry** within the window; different keys execute independently.

5. **`withLock` serializes correctly** — two concurrent operations with the same lock key execute one after the other; without the same key, in parallel.

6. **Observable wrapper produces spans, logs, metrics** for every service call — verified end-to-end through Grafana.

7. **Service unit tests run in < 100ms total** for the WorkspaceService test file.

8. **Service integration tests run against all three database adapters** in CI matrix mode; all pass.

9. **Authorization failures are not logged at error level** — they're info or debug, since they're expected. Internal failures are error.

10. **An unknown error thrown from a deep helper** is caught at the service boundary, wrapped in `InternalError`, logged at fatal, and returned as a Result.

11. **The error hierarchy is exhaustive** — every error returned from any service method is an instance of one of the typed classes; no bare Errors leak.

12. **Pre-existing services refactored to canonical pattern** — WorkspaceService, MemberService, AuthService all pass the linter and look identical structurally.

13. **Service author's guide checklist is followed by a fresh new service** — writing a small new service feels mechanical, no architectural decisions required.

14. **Concurrency tests** — generate 1000 concurrent operations across multiple workspaces; correctness preserved (no lost updates, no duplicate audits).

15. **Documentation matches code** — the service author's guide accurately describes what the linter enforces.

If all 15 pass, the objective is met.

---

## 20. Definition of Done

**Patterns Locked**

- [ ] `RequestContext` and `SystemContext` types finalized in `@platform/shared`
- [ ] Error hierarchy complete in `@platform/shared/errors`
- [ ] Canonical service method shape documented and exemplified

**Mechanical Helpers**

- [ ] `observable()` wrapper implemented and used by all services
- [ ] `withLock` helper with adapters for all three databases
- [ ] Idempotency infrastructure (table, helper, retention)
- [ ] `uow.transaction` from Objective 4 family integrated with service patterns

**Linter Rules**

- [ ] Custom ESLint rules implemented
- [ ] Rules tested in `packages/config/tests/lint-rules/`
- [ ] CI runs the rules on every PR

**Code Generator**

- [ ] `pnpm new-service` works end-to-end
- [ ] Generated services pass linter, tests, and conformance

**Existing Services Refactored**

- [ ] `WorkspaceService` follows canonical shape
- [ ] `MemberService` follows canonical shape
- [ ] `AuthService` (from Objective 5) follows canonical shape
- [ ] Any other services from earlier work updated

**Tests**

- [ ] Unit-test pattern established with in-memory adapters
- [ ] Integration-test pattern with real adapters in matrix mode
- [ ] Both patterns demonstrated in WorkspaceService.test.ts as the reference

**Documentation**

- [ ] `docs/contracts/service-authoring.md` written
- [ ] ADRs 0076–0082 written and Accepted
- [ ] Reference service heavily commented as a teaching artifact

**Verification**

- [ ] All 15 verification steps in Section 19 pass

---

## 21. Anti-Patterns to Refuse

- **Service methods without `ctx` parameter.** Linter catches; reviewers reject.
- **Service methods that throw.** Use `Result`. The wrapper catches stray throws as a safety net, but throwing intentionally is the antipattern.
- **Service methods that take 8 parameters.** The pattern is `(ctx, input)`. Multiple inputs go into the input object.
- **Direct adapter imports from service code.** Linter catches.
- **Skipping the validation step "because TypeScript already typed it."** Runtime input is not type-safe. Validate.
- **Skipping the authorization step "because this is internal."** Internal callers use `SystemContext`, which has its own implicit "system can do anything" semantics. User-context calls authorize.
- **Skipping the audit step "because this isn't a state change."** If it's not a state change, fine. If it is, audit is required.
- **Audit events outside the transaction.** A rolled-back operation that left an audit lying about it is a forensic disaster.
- **Bare `throw new Error(...)` in service code.** Use the hierarchy. If nothing fits, add a class.
- **Cross-service calls that bypass authorization.** A service calling another service is fine; the inner service still authorizes. Each service is its own boundary.
- **Long-running operations holding transactions.** External calls (HTTP, AI generation) inside transactions are antipatterns. Stage the operation: prepare → external call → commit.
- **Adding state to service instances.** Services are stateless. State lives in `ctx`, in the database, or in injected stateful dependencies (which are themselves stateless wrappers around databases).
- **Skipping the generator and writing services by hand "for variety."** The generator enforces the convention. Variety is a debt.

---

## 22. Open Questions for Confirmation Before Starting

1. **TypeScript decorators vs. higher-order wrapper for the observable pattern.** Decorators are cleaner but require `experimentalDecorators: true` (and the new ECMAScript decorators are still emerging). Recommendation: use higher-order wrapping at the factory level for now; revisit decorators when ECMAScript-standard ones are stable.

2. **Idempotency window default of 24 hours** — appropriate? Some operations want shorter (auth flows: 5 minutes); some want longer (deployments: 7 days). Recommendation: 24h default; per-operation override.

3. **Linter rule strictness** — should `audit-on-mutation` be a hard error or a warning? Recommendation: warning. Heuristics produce false positives (e.g., a method named `update` that just updates a cache).

4. **Generator scope** — should it also create the route handler? The repository factory? Or stay focused on the service file alone? Recommendation: focused on service for now; generators for routes and other layers are separate, simpler.

5. **Service-to-service calls vs. shared helper modules** — when does shared logic become a service vs. stay a helper? Heuristic: if it touches the database OR emits audit events, it's a service. Otherwise it's a helper.

---

## 23. What Comes Next

With Objective 8 complete, the platform's service layer is a discipline, not a hope. Every feature objective from this point uses the canonical pattern. New services are mechanical to write. The codebase doesn't fragment.

**Objective 9: Cross-Platform Runtime** is next. The platform was designed for Linux + Windows from the start; this objective makes Windows real. Required for Microsoft house customers.

**Objective 10: Quality Gates Before Stage One** consolidates the foundation: load tests, penetration tests, chaos drills, accessibility baselines, and the security checklist that confirms the platform is genuinely ready for production.

After Objective 10, the foundation is genuinely complete. **Stage 1 of the AI build pipeline (Intent Capture) and the Data Management Module both begin** on a foundation an enterprise security review wouldn't reject.

---

_This document is the contract. Every checkbox in Section 20 must be true before moving on._
