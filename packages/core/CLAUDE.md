# CLAUDE.md — packages/core

Domain logic, services, and the authoritative implementation of the platform's
business rules. This package has no adapter imports; it imports only from
`@platform/ports-*`.

---

## What lives here

| Path                 | Purpose                                                                                |
| -------------------- | -------------------------------------------------------------------------------------- |
| `src/errors.ts`      | Typed `AppError` hierarchy — `ValidationError`, `NotFoundError`, `ConflictError`, etc. |
| `src/context.ts`     | Context factories and helpers (`makeSystemContext`, `toAuditActor`, `auditMeta`)       |
| `src/services/`      | Service classes — one file per domain                                                  |
| `src/repositories/`  | `bindToContext` — workspace-scoping wrapper for repos                                  |
| `src/observability/` | `observable()` higher-order wrapper for service method instrumentation                 |
| `src/idempotency/`   | `withIdempotency` helper + `IdempotencyRecord` type                                    |
| `src/compliance/`    | Personal data registry, audit event catalog                                            |
| `src/approvals/`     | Approval routing engine                                                                |
| `src/testing/`       | In-memory adapters and context factories for unit tests                                |

---

## Service method shape

Every public service method follows this canonical pipeline without exception:

```
validate → authorize → precondition → execute → audit → return
```

See `docs/contracts/service-authoring.md` for the full guide and checklist.

Quick rules:

- First parameter is always `ctx: RequestContext | SystemContext`
- Returns `Promise<Result<T, AppError>>` — never throws for expected failures
- Validate with zod `safeParse` as step 1 (before any I/O)
- Authorize via `this.authz.authorize(ctx, action, resource)` as step 2
- `audit.write()` for every state change — inside any surrounding transaction
- Assert error codes in tests: `result._unsafeUnwrapErr().code === 'VALIDATION'`

---

## Errors

`packages/core/src/errors.ts` defines the full `AppError` hierarchy.

Every class has:

- `code: AppErrorCode` — stable, machine-readable; assert this in tests, never `.message`
- `statusCode: number` — HTTP status for the API layer
- `metadata: Record<string, unknown>` — structured details (field paths, constraint names)

The ESLint rule `platform/no-bare-error-throws` catches `throw new Error(...)`.
Use a typed subclass; if none fits, add one.

---

## Testing pattern

Unit tests use the in-memory adapters from `src/testing/`:

```typescript
import { createInMemoryAudit, createInMemoryAuthz, createInMemoryLogger, createInMemoryRepo, makeUserContext } from '../testing/index.js';
```

- `createInMemoryAuthz({ deny: true })` — denies all operations (for testing auth failures)
- `createInMemoryAuthz({ denyActions: ['foo.create'] })` — deny specific actions
- `adapters.audit.events` — array of all written audit entries for assertions
- `adapters.workspaces.store` — the underlying `Map<string, T>` for direct inspection

Reference test: `src/services/workspace.service.test.ts`.

---

## Adding a service

```bash
pnpm new-service <Name>
```

The generator creates `<name>.service.ts` and `<name>.service.test.ts` with the
canonical shape pre-scaffolded, and updates `src/index.ts`. Fill in the
constructor deps, implement the method bodies, and wire into the composition root.

---

## ESLint rules

Three custom rules apply to this package (and all packages):

| Rule                                    | Level | What it catches                                                   |
| --------------------------------------- | ----- | ----------------------------------------------------------------- |
| `platform/service-method-context-first` | error | Public async Service methods missing `ctx` as first param         |
| `platform/no-bare-error-throws`         | error | `throw new Error(...)` — must use typed AppError                  |
| `platform/audit-on-mutation`            | warn  | Mutation methods (create/update/delete/…) without `audit.write()` |

---

## Dependency rules

`packages/core` may import:

- `@platform/ports-*` — any port interface
- Third-party libraries (`neverthrow`, `zod`, `uuidv7`, `node:crypto`)

`packages/core` must NOT import:

- `@platform/adapter-*` — any adapter package
- `@platform/adapters/*` — same

`dependency-cruiser` enforces this in CI. If a build fails on a boundary
violation, find the right port interface rather than adding the adapter import.
