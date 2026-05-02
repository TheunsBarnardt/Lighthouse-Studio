# Lighthouse Studio

A self-hosted AI development platform that delivers two products on one foundation:

1. **Data Management Module** — A Supabase equivalent supporting PostgreSQL, MSSQL, and MongoDB
2. **AI Build Pipeline** — A structured AI-assisted development pipeline from idea to deployment

Licensed under [AGPL-3.0](./LICENSE). Self-hosted, no vendor lock-in.

---

## Status

**Foundation in progress.** Objectives 1, 1.5, and 2 are complete (repository, abstraction architecture, environment strategy). See [`docs/development-plan.md`](./docs/development-plan.md) for the roadmap.

---

## Prerequisites

| Tool    | Version    | Notes                                                                            |
| ------- | ---------- | -------------------------------------------------------------------------------- |
| Node.js | 22.x LTS   | Use [nvm](https://github.com/nvm-sh/nvm) or [fnm](https://github.com/Schniz/fnm) |
| pnpm    | 10.x       | `npm install -g pnpm@10.11.0`                                                    |
| Git     | Any recent | Git for Windows includes Git Bash                                                |
| Docker  | 24+        | Required for local offline dev mode (`pnpm setup:local-db`)                      |

**Windows users:** run these once before cloning:

```bash
git config --global core.autocrlf false
git config --global core.longpaths true
```

---

## Local development quickstart

```bash
# Clone
git clone <repo-url>
cd platform

# One-command setup (installs deps, creates .env.local, offers to start local DB)
pnpm setup

# Start the dev server
pnpm dev

# Verify the platform is healthy
curl http://localhost:3000/_status
```

The setup script guides you through creating `.env.local` from `.env.example`.
See [`.env.example`](./.env.example) for all available configuration variables.

**Online mode (default):** your machine connects to the dev environment on the Afrihost VPS.

**Offline mode:** run `pnpm setup:local-db` to start Postgres + Redis via Docker, then set your `.env.local` to use `localhost` connection strings.

---

## Environment topology

The reference deployment runs on a single Afrihost VPS (Ubuntu 24.04 LTS, 8 GB RAM):

```
Caddy (auto-SSL, reverse proxy)
├── dev.<DOMAIN>          → web-dev container     [Active]
├── staging.<DOMAIN>      → web-staging container [Dormant — activates when buy-in lands]
├── <DOMAIN> (apex)       → web-prod container    [Dormant — activates when buy-in lands]
└── coolify.<DOMAIN>      → Coolify admin UI       [Active, IP-restricted]
```

| Branch    | Environment | Deploys                      |
| --------- | ----------- | ---------------------------- |
| `develop` | dev         | Automatically                |
| `staging` | staging     | Manual approval required     |
| `main`    | prod        | Manual approval + 5-min wait |

---

## Scripts

| Command                  | Description                                          |
| ------------------------ | ---------------------------------------------------- |
| `pnpm setup`             | One-command local dev setup (idempotent)             |
| `pnpm setup:local-db`    | Start local Postgres + Redis via Docker              |
| `pnpm teardown:local-db` | Stop and remove local Docker volumes                 |
| `pnpm dev`               | Start all apps in dev mode                           |
| `pnpm build`             | Build all packages                                   |
| `pnpm lint`              | Lint all packages                                    |
| `pnpm typecheck`         | Type-check all packages                              |
| `pnpm test`              | Run all tests                                        |
| `pnpm format`            | Format all files with Prettier                       |
| `pnpm format:check`      | Check formatting without writing                     |
| `pnpm boundaries`        | Check hexagonal architecture boundaries              |
| `pnpm env:check`         | Validate environment variables from .env.local       |
| `pnpm env:completeness`  | Verify .env.example and schema are in sync           |
| `pnpm db:reset:dev`      | Wipe dev database and reseed (requires confirmation) |
| `pnpm seed:dev`          | Seed the dev database                                |
| `pnpm check-workspace`   | Validate workspace invariants                        |
| `pnpm new-package`       | Generate a new package                               |
| `pnpm clean`             | Remove all build outputs                             |

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

Adapter selection is via environment variables — no code changes required to switch databases or identity providers. See [ADR-0003](./docs/adr/0003-adapter-selection-via-env.md) and [ADR-0002](./docs/adr/0002-environment-strategy.md).

See all ADRs in [`docs/adr/`](./docs/adr/).

---

## Operational runbooks

| Runbook                                                         | Purpose                               |
| --------------------------------------------------------------- | ------------------------------------- |
| [Server provisioning](./docs/runbooks/server-provisioning.md)   | Initial VPS setup                     |
| [Environments](./docs/runbooks/environments.md)                 | Overview, access, operations          |
| [Secret rotation](./docs/runbooks/secret-rotation.md)           | Rotating credentials without downtime |
| [Backup and restore](./docs/runbooks/backup-and-restore.md)     | Restic + Backblaze B2                 |
| [Disaster recovery](./docs/runbooks/disaster-recovery.md)       | Full server loss procedure            |
| [Provisioning staging](./docs/runbooks/provisioning-staging.md) | Activating the staging environment    |
| [Provisioning prod](./docs/runbooks/provisioning-prod.md)       | Activating production                 |
| [Domain change](./docs/runbooks/domain-change.md)               | Moving to a different domain          |
| [Adapter switching](./docs/runbooks/adapter-switching.md)       | Switching storage, identity, etc.     |
| [Windows deployment](./docs/runbooks/windows-deployment.md)     | Windows Server + IIS deployment guide |

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). A signed CLA is required before contributions are accepted.

---

## Security

To report a vulnerability, see [SECURITY.md](./SECURITY.md).
