# Platform Ports

Ports are the interfaces the platform's domain logic uses for all I/O. Core business logic never calls a database driver, storage SDK, or external service directly — it calls a port. Adapters implement the ports; the composition root wires them together.

## Location and naming

Each port is a separate workspace package under `packages/ports/`. Package names follow the convention `@platform/ports-<name>`.

## The 11 ports

| Package                         | Purpose                                                                      |
| ------------------------------- | ---------------------------------------------------------------------------- |
| `@platform/ports-persistence`   | Unit of work, repositories, schema introspection, DDL, migrations, raw query |
| `@platform/ports-identity`      | Identity provider, user directory, session management                        |
| `@platform/ports-storage`       | Object storage (buckets, blobs)                                              |
| `@platform/ports-communication` | Outbound email                                                               |
| `@platform/ports-eventing`      | Event bus, change streams                                                    |
| `@platform/ports-search`        | Full-text search, vector store, embeddings                                   |
| `@platform/ports-ai`            | AI generation (completions, structured output)                               |
| `@platform/ports-jobs`          | Job queue, scheduler                                                         |
| `@platform/ports-observability` | Logger, metrics, tracer                                                      |
| `@platform/ports-audit`         | Audit event recording                                                        |
| `@platform/ports-config`        | Secret store, feature flags                                                  |

## Package exports

Each port package exposes two export conditions:

- `.` — the TypeScript interfaces, error types, and value types that define the contract
- `./conformance` — a parameterized test suite that any adapter for this port must pass

Example:

```typescript
// Consuming the interface in core or service code
import type { RepositoryPort } from '@platform/ports-persistence';

// Consuming the conformance suite in an adapter's test file
import { runRepositoryConformance } from '@platform/ports-persistence/conformance';
```

## Rules

- Port files never import from adapter packages. The dependency arrow is one-way: adapters depend on ports, not the reverse.
- No driver libraries (`pg`, `mongodb`, `aws-sdk`, etc.) appear in port `package.json` dependencies. Ports describe contracts; they do not pull in implementations.
- All fallible operations return `Result<T, E>` from `neverthrow`. Ports do not throw for expected error conditions.

## Conformance test suites

Each port's `./conformance` export contains parameterized test functions exported from `src/conformance/*.ts`. A conformance test function accepts a fixture (a factory that creates an instance of the adapter under test) and registers a suite of `it`/`describe` blocks using Vitest.

Adapters run the full conformance suite in their own `tests/*.spec.ts` file. This guarantees that any adapter can substitute for any other without changing the behavior that core code depends on.

## Adding a new port

1. Create `packages/ports/<name>/` with the following structure:
   ```
   package.json       — name: "@platform/ports-<name>", no driver deps
   tsconfig.json      — extends root tsconfig; exports src/index.ts
   src/index.ts       — re-exports all interfaces and types
   src/errors.ts      — domain error types for this port
   src/conformance/   — parameterized conformance test functions
   src/conformance/index.ts
   ```
2. Add the package to the `references` array in the root `tsconfig.json`.
3. Add a contract document at `docs/contracts/<name>.md` describing the interface semantics, error conditions, and capability flags.
4. Write the conformance suite before writing any adapter — it defines the contract precisely.

## Full interface contracts

See `docs/contracts/` for the authoritative contract documentation for each port. Interface contracts describe semantics that TypeScript types cannot express: ordering guarantees, atomicity boundaries, idempotency requirements, and capability flags for optional sub-interfaces.
