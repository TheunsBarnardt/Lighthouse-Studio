# Contributing to Lighthouse Studio

Thank you for your interest in contributing. This document explains how to work in this repository.

---

## CLA Requirement

All contributors must sign the [Contributor License Agreement](./.github/CLA.md) before their pull request can be merged. The CLA Assistant bot will comment on your PR and block the merge until the CLA is signed.

The project owner (Theuns Barnardt) is auto-signed.

---

## Branching strategy

- `main` is protected. No direct pushes. All changes go through pull requests.
- Work on a feature branch: `git checkout -b feat/my-feature`
- Branch names: `feat/`, `fix/`, `docs/`, `chore/`, `refactor/`, `test/`
- One logical change per PR. If a PR is getting large, split it.

---

## Commit messages

We use [Conventional Commits](https://www.conventionalcommits.org/). The `commit-msg` hook enforces this.

```
feat: add persistence port interface
fix: correct workspace scoping in query builder
docs: update ADR-0001 with revised rationale
chore: upgrade turbo to 2.5.0
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`

Subjects: lowercase, no period at end, max 72 characters.

---

## Running locally

### Prerequisites

| Tool    | Version                           |
| ------- | --------------------------------- |
| Node.js | 22.x LTS (`nvm use` in repo root) |
| pnpm    | 10.x                              |

**Windows only:**

```bash
git config --global core.autocrlf false
git config --global core.longpaths true
```

### Setup

```bash
# One-command setup — installs deps, creates .env.local, optionally starts local DB
pnpm setup

# Or manually:
pnpm install          # install all workspace deps
pnpm build            # build packages in dependency order
pnpm lint             # lint all packages
pnpm typecheck        # type-check all packages
pnpm test             # run all tests
pnpm boundaries       # verify architecture boundaries
pnpm check-workspace  # verify workspace invariants
```

### Local development modes

**Online mode (default):** your machine connects to the dev environment on the Afrihost VPS. Configure `.env.local` with the dev environment's connection strings. Use this for day-to-day development.

**Offline mode:** run `pnpm setup:local-db` to start a local Postgres + Redis via Docker. Set `POSTGRES_URL=postgres://platform:platform@localhost:5432/platform_dev` and `REDIS_URL=redis://localhost:6379` in `.env.local`. Use this when travelling, at demos, or debugging locally.

### Environment variables

All environment variables are documented in [`.env.example`](./.env.example). Copy it to `.env.local` and fill in the values. The schema with validation lives in `packages/config/src/env/schema.ts`.

Validate your `.env.local`:

```bash
pnpm env:check
```

Never commit `.env.local` or any file containing secrets. `gitleaks` will block the commit if it detects secrets.

---

## Promotion workflow

Changes flow through three environments in order:

```
feature branch → develop (PR) → staging (merge + approval) → main (merge + approval + 5-min timer)
         ↓                ↓                   ↓
       local             dev             staging → prod
```

**To deploy to dev:** merge your PR to `develop`. GitHub Actions builds the image and triggers a Coolify deploy automatically.

**To promote to staging:** merge `develop` into `staging`. A GitHub Actions reviewer must approve the deployment in the GitHub Actions UI.

**To promote to production:** merge `staging` into `main`. A reviewer must approve, then wait 5 minutes before the deploy executes.

Never push directly to `staging` or `main` — branch protection rules block this.

---

## Adding a new package

Use the generator — don't create packages manually:

```bash
pnpm new-package
```

It will prompt for the type (port, adapter, app, or lib), name, and (for adapters) which port it implements. It creates the full skeleton and updates `tsconfig.json` references automatically.

---

## Architecture rules

The hexagonal architecture is **mechanically enforced** by `dependency-cruiser`. The rules are in [`.dependency-cruiser.cjs`](./.dependency-cruiser.cjs).

Key rules:

- `packages/ports/` — interfaces only; no imports from `packages/adapters/`
- `packages/core/` — business logic; imports ports but never adapters
- `packages/adapters/` — only imported from `packages/composition/`
- `apps/` — no direct adapter imports (use composition root)

If `pnpm boundaries` fails, fix the import — do not modify the rules.

---

## Adding an ADR

When you make an architectural decision:

```bash
cp docs/adr/0000-template.md docs/adr/NNNN-short-title.md
# Edit, set status to Proposed
# PR merges → status becomes Accepted
```

ADR numbers are sequential across the whole repo. Check the latest before assigning.

---

## Definition of Done

Every PR must satisfy:

- [ ] TypeScript compiles with no errors
- [ ] ESLint passes with `--max-warnings=0`
- [ ] All tests pass
- [ ] Prettier formatting applied
- [ ] Boundary check passes
- [ ] Relevant `objectives/` document read before implementing
- [ ] ADR written if an architectural decision was made
- [ ] No `any` types
- [ ] No `console.log` in production code paths
- [ ] README updated if public API changed

---

## Getting help

Open an issue using the [feature request](./.github/ISSUE_TEMPLATE/feature_request.md) or [bug report](./.github/ISSUE_TEMPLATE/bug_report.md) template.
