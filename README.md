# Lighthouse Studio

A self-hosted AI development platform that delivers two products on one foundation:

1. **Data Management Module** — A Supabase equivalent supporting PostgreSQL, MSSQL, and MongoDB
2. **AI Build Pipeline** — A structured AI-assisted development pipeline from idea to deployment

Licensed under [AGPL-3.0](./LICENSE). Self-hosted, no vendor lock-in.

---

## Status

**Foundation in progress.** Objective 1 (repository & tooling) is complete. See [`docs/development-plan.md`](./docs/development-plan.md) for the roadmap.

---

## Prerequisites

| Tool    | Version    | Notes                                                                            |
| ------- | ---------- | -------------------------------------------------------------------------------- |
| Node.js | 22.x LTS   | Use [nvm](https://github.com/nvm-sh/nvm) or [fnm](https://github.com/Schniz/fnm) |
| pnpm    | 10.x       | `npm install -g pnpm@10.11.0`                                                    |
| Git     | Any recent | Git for Windows includes Git Bash                                                |

**Windows users:** run these once before cloning:

```bash
git config --global core.autocrlf false
git config --global core.longpaths true
```

---

## Quickstart

```bash
# Clone and install
git clone <repo-url>
cd platform
nvm use         # or: fnm use
pnpm install

# Build all packages
pnpm build

# Run all checks
pnpm lint
pnpm typecheck
pnpm test
pnpm boundaries
```

---

## Scripts

| Command                | Description                                      |
| ---------------------- | ------------------------------------------------ |
| `pnpm dev`             | Start all apps in dev mode                       |
| `pnpm build`           | Build all packages                               |
| `pnpm lint`            | Lint all packages                                |
| `pnpm typecheck`       | Type-check all packages                          |
| `pnpm test`            | Run all tests                                    |
| `pnpm format`          | Format all files with Prettier                   |
| `pnpm format:check`    | Check formatting without writing                 |
| `pnpm boundaries`      | Check hexagonal architecture boundaries          |
| `pnpm check-workspace` | Validate workspace invariants                    |
| `pnpm new-package`     | Generate a new package (port, adapter, app, lib) |
| `pnpm clean`           | Remove all build outputs                         |

---

## Architecture

Hexagonal architecture enforced by [`dependency-cruiser`](./.dependency-cruiser.cjs):

```
apps/ (web, worker)
  └─ packages/composition/     ← only place that wires adapters to ports
       ├─ packages/core/        ← domain + service layer; imports ports only
       ├─ packages/ports/       ← abstract interfaces (persistence, identity, ...)
       └─ packages/adapters/    ← implementations (postgres, mssql, mongo, ...)
```

See [`docs/architecture/`](./docs/architecture/) and ADRs in [`docs/adr/`](./docs/adr/).

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). A signed CLA is required before contributions are accepted.

---

## Security

To report a vulnerability, see [SECURITY.md](./SECURITY.md).
