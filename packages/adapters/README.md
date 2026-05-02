# Platform Adapters

Adapters implement port interfaces for specific technologies. Each adapter package provides a concrete implementation of one port for one technology, satisfying the full conformance suite defined by that port.

## Location and naming

Each adapter is a separate workspace package under `packages/adapters/`. Package names follow the convention `@platform/adapter-<port>-<technology>`.

Examples: `@platform/adapter-persistence-postgres`, `@platform/adapter-identity-entra`, `@platform/adapter-storage-s3`.

## Current adapters

The following in-memory adapters exist, one per port. They are for development and testing only — not for production use.

| Package                                  | Port                            |
| ---------------------------------------- | ------------------------------- |
| `@platform/adapter-persistence-memory`   | `@platform/ports-persistence`   |
| `@platform/adapter-identity-memory`      | `@platform/ports-identity`      |
| `@platform/adapter-storage-memory`       | `@platform/ports-storage`       |
| `@platform/adapter-communication-memory` | `@platform/ports-communication` |
| `@platform/adapter-eventing-memory`      | `@platform/ports-eventing`      |
| `@platform/adapter-search-memory`        | `@platform/ports-search`        |
| `@platform/adapter-ai-memory`            | `@platform/ports-ai`            |
| `@platform/adapter-jobs-memory`          | `@platform/ports-jobs`          |
| `@platform/adapter-observability-memory` | `@platform/ports-observability` |
| `@platform/adapter-audit-memory`         | `@platform/ports-audit`         |
| `@platform/adapter-config-memory`        | `@platform/ports-config`        |

## Rules

- Adapters may import from their corresponding port package and from driver libraries (`pg`, `mongodb`, `aws-sdk`, etc.).
- Adapters must never be imported by application code or core packages directly. The only package that imports from adapters is `packages/composition`. All other packages receive a `PlatformContainer` via dependency injection.
- Every adapter must pass the full conformance suite exported from its port's `./conformance` entrypoint.

## Directory structure

```
packages/adapters/<port>-<tech>/
  package.json
  tsconfig.json
  src/
    index.ts          — exports the adapter class(es)
    ...               — implementation files
  tests/
    conformance.spec.ts   — imports and runs the port's conformance suite
```

The `tsconfig.json` uses `"rootDir": "."` so that both `src` and `tests` are compiled in the same pass.

## Adding a new adapter

1. Create `packages/adapters/<port>-<tech>/`.
2. Copy `package.json` and `tsconfig.json` from an existing adapter of similar complexity. Update `name`, `description`, and dependencies.
3. Implement the port interface(s) in `src/`. Import types from the port package; import driver libraries as needed.
4. Add `tests/conformance.spec.ts` that imports the conformance suite from `@platform/ports-<name>/conformance` and runs it against your implementation.
5. Add the package to the `references` array in the root `tsconfig.json`.
6. Confirm all conformance tests pass before marking the adapter ready for use.

## Conformance tests

The conformance suite is the acceptance bar. An adapter that passes conformance can substitute for any other adapter for the same port without requiring changes to core or service code. If your adapter cannot satisfy a conformance test, either the adapter has a genuine limitation (document it as a capability flag in the port contract) or the implementation is incomplete.
