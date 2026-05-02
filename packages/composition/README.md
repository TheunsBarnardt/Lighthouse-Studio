# Composition Root

The composition root is the only package that imports from both port packages and adapter packages. It wires adapters to ports at startup and hands the result to the rest of the application as a `PlatformContainer`.

## Exports

```typescript
import { composeMemory } from '@platform/composition';
import type { PlatformContainer, PersistenceBundle } from '@platform/composition';
```

- `PlatformContainer` — the DI container type; holds one instance of every port the platform uses
- `PersistenceBundle` — the sub-type for `container.persistence`; groups all persistence-related ports
- `composeMemory()` — factory that wires all in-memory adapters; returns a `PlatformContainer`

## Using `composeMemory()`

`composeMemory()` is the factory for development and testing. It wires every port to its in-memory adapter and returns a fully assembled container.

```typescript
import { composeMemory } from '@platform/composition';

const container = composeMemory();

// Persistence
const uow = container.persistence.unitOfWork;
const userRepo = container.persistence.repository<User>('users');

// Other ports
container.identity; // IdentityProviderPort
container.audit; // AuditPort
container.storage; // ObjectStoragePort
container.eventBus; // EventBusPort
container.ai; // AiGenerationPort
container.logger; // LoggerPort
// ... and so on for all 11 ports
```

## The `repository` factory

`container.persistence.repository` is a factory function, not a fixed property. Call it with an entity name to get a `RepositoryPort<TEntity>` backed by the configured adapter. The composition root manages the lifecycle of repository instances.

```typescript
const userRepo = container.persistence.repository<User>('users');
const postRepo = container.persistence.repository<Post>('posts');
```

## Why a single composition root

Adapter package names appear in `import` statements in exactly one place: this package. All other packages — core, services, apps — receive a `PlatformContainer` through dependency injection. This means:

- Swapping an adapter (e.g., replacing the in-memory identity provider with an Entra adapter) requires a change in one file, not throughout the codebase.
- Core and service packages have no compile-time dependency on any adapter package.
- Tests that need full wiring call `composeMemory()`; tests that need to isolate one concern pass mock implementations of individual ports directly.

## Future: `compose()`

A `compose()` factory will serve as the production entry point. It will read environment variables (`DATABASE_DRIVER`, `IDENTITY_DRIVER`, `STORAGE_DRIVER`, etc.) and select the appropriate adapter for each port at startup. The returned `PlatformContainer` will have the same shape as the one returned by `composeMemory()` — callers are unaffected by which adapters are active.
