# Glossary

**Adapter** — A concrete implementation of a port interface. Lives in `packages/adapters/`. Examples: `adapter-persistence-postgres`, `adapter-identity-builtin`.

**Audit event** — A structured record of a significant action taken in the platform (e.g. "user created", "schema migrated"). Immutable once written.

**Capability matrix** — A table documenting which features each adapter implementation supports. Used to surface database-specific limitations in the UI.

**Composition root** — `packages/composition/`. The single place where adapters are wired to ports. The only package allowed to import both ports and adapters.

**Conformance test** — A shared test suite that every adapter for a given port must pass. Defined in `packages/ports/<port>/conformance/`. Guarantees adapter interchangeability.

**Core** — `packages/core/`. Contains domain entities and the service layer. Imports only ports; never adapters.

**Port** — An abstract TypeScript interface defining a capability (e.g. `RepositoryPort`, `IdentityPort`). Lives in `packages/ports/`. No implementation.

**Result type** — `Result<T, E>` from `neverthrow`. Used internally for typed error handling without throwing. The public SDK uses native Promises.

**Workspace** — A tenant boundary in the platform. All data is scoped to a workspace. Multi-tenant isolation is enforced at the service layer.
