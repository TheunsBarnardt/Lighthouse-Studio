# ADR-0078: Constructor Injection over Service Locator

**Status:** Accepted
**Date:** 2026-05-02
**Objective:** 08-service-layer-architecture

---

## Context

Services depend on ports (authorization, persistence, audit, logging). There
are two common ways to supply dependencies: constructor injection (caller passes
them in) and service locator (callee fetches them from a registry or singleton).

The platform uses a manual composition root (`packages/composition/`) that
assembles the full dependency graph at startup. The question is how services
receive their dependencies.

---

## Decision

Services receive all dependencies via constructor parameters. No service locator,
no global registry, no `import` of adapter singletons from inside service code.

```typescript
export class WorkspaceService {
  constructor(
    private readonly authz: AuthorizationPort,
    private readonly workspaces: RepositoryPort<Workspace>,
    private readonly audit: AuditPort,
    private readonly logger: LoggerPort,
  ) {}
}
```

Services are stateless objects; per-request state travels in `ctx`. The
composition root constructs services once and they live for the lifetime of the
process.

Factory functions (`createWorkspaceService(deps)`) are the testability hook:
tests call the factory with mock adapters.

---

## Consequences

**What becomes easier:**

- Every dependency is visible at a glance from the constructor signature.
- Swapping adapters (e.g., switching persistence backends) is a composition-root
  change, not a service code change.
- Tests pass mock adapters without patching globals or module systems.

**What becomes harder:**

- The composition root wires everything explicitly; it grows as services are
  added. This is manageable because the composition root is intentionally one
  file.

**Alternatives considered:**

- _Service locator / singleton registry_ — rejected; hides dependencies, makes
  testing difficult, couples service code to the registry implementation.
- _IoC container (InversifyJS, tsyringe)_ — rejected; adds a framework dependency
  and magic decorators. Manual composition is explicit and type-safe.
