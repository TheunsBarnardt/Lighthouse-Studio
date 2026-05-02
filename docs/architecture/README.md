# Architecture

Lighthouse Studio uses **hexagonal architecture** (also known as ports and adapters).

## Layer Map

```
apps/
  web/       ← Next.js frontend (UI only; no business logic)
  worker/    ← AI pipeline worker (async job processing)

packages/
  composition/   ← Dependency injection root; wires adapters to ports
  core/          ← Domain entities + service layer
  ports/         ← Abstract interfaces (no implementations)
    persistence/
    identity/
    storage/
    communication/
    eventing/
    search/
    ai/
    jobs/
    observability/
    audit/
    config/
  adapters/      ← Concrete implementations (one folder per adapter)
    persistence-postgres/
    persistence-mssql/
    persistence-mongo/
    ... (added as objectives progress)
  shared/        ← Pure utilities; no business semantics
  observability/ ← Structured logging, metrics, tracing
  ui/            ← Shared React component library
  config/        ← Shared TypeScript, ESLint, Prettier configs
```

## Dependency Rules

These are enforced mechanically by `dependency-cruiser`:

1. **Ports never import adapters** — port interfaces are pure abstractions
2. **Core never imports adapters** — only imports ports
3. **Only composition imports adapters** — the composition root is the single wiring point
4. **No circular dependencies**

## Adding a New Port

See `CONTRIBUTING.md` → "Adding a new package" and read `objectives/01.5-abstraction-architecture.md`.
