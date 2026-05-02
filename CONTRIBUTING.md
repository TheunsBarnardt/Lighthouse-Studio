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
pnpm install          # install all workspace deps
pnpm build            # build packages in dependency order
pnpm lint             # lint all packages
pnpm typecheck        # type-check all packages
pnpm test             # run all tests
pnpm boundaries       # verify architecture boundaries
pnpm check-workspace  # verify workspace invariants
```

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
