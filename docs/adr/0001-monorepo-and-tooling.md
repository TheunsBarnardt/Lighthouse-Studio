# ADR-0001: Monorepo and Tooling Decisions

**Status:** Accepted
**Date:** 2026-05-02
**Deciders:** solo (Theuns Barnardt)

## Context

The platform requires a substrate that supports a monorepo of TypeScript packages covering ports, adapters, core domain logic, UI, and two applications — all while enforcing a hexagonal architecture mechanically rather than by policy. The tooling must work on both Linux and Windows, support strict TypeScript, and provide a fast developer feedback loop.

## Decision

The following decisions are locked for the lifetime of the project (reverting any requires a new ADR):

| Decision               | Choice                                             |
| ---------------------- | -------------------------------------------------- |
| Monorepo tool          | Turborepo + pnpm workspaces                        |
| Package manager        | pnpm (pinned via `packageManager` field)           |
| Node runtime           | Node 22 LTS                                        |
| Language               | TypeScript 5.x with `strict: true`                 |
| Linter                 | ESLint 9 (flat config)                             |
| Formatter              | Prettier                                           |
| Result handling        | `neverthrow`                                       |
| Schema validation      | `zod`                                              |
| Git hooks              | Husky + lint-staged                                |
| Commit format          | Conventional Commits via commitlint                |
| CI provider            | GitHub Actions                                     |
| Dependency updates     | Renovate                                           |
| Editor config          | `.editorconfig` + VS Code extensions               |
| Cross-platform scripts | `tsx`-based Node scripts only (no bash/PowerShell) |
| Boundary enforcement   | `dependency-cruiser`                               |
| License                | AGPL-3.0                                           |
| CLA tool               | CLA Assistant                                      |

## Consequences

### Positive

- Turborepo provides task caching and parallel execution; new packages slot in without ad-hoc configuration.
- pnpm's strict dependency resolution catches phantom dependency bugs early.
- `dependency-cruiser` makes hexagonal boundary violations impossible to accidentally merge.
- Conventional Commits enable automated changelog generation in future.
- `neverthrow` enforces typed error handling at port boundaries, eliminating untyped `throw`.
- Node 22 LTS provides native fetch, V8 improvements, and long-term security support.
- AGPL-3.0 prevents hyperscaler resale of the platform without contribution back.

### Negative

- Strict TypeScript and `noUncheckedIndexedAccess` require more explicit code; initial velocity is slightly lower.
- pnpm workspace protocol means cross-package imports require `workspace:*` — more verbose than relative paths.
- ESLint type-aware rules require `parserOptions.projectService`, which adds type-check overhead to lint.

### Neutral

- Renovate rather than Dependabot: more configuration surface but more control over grouping and scheduling.

## Alternatives Considered

### Option A: Nx instead of Turborepo

Nx has more features (affected graph, generators, etc.) but higher overhead and a steeper learning curve for a solo project. Turborepo is simpler and sufficient.

### Option B: Yarn Berry instead of pnpm

Yarn Berry's Plug'n'Play mode eliminates `node_modules` entirely but has compatibility issues with some tools and is harder to debug. pnpm's virtual store is a better tradeoff.

### Option C: `biome` instead of ESLint + Prettier

Biome is faster but does not yet have parity with `@typescript-eslint`'s type-aware rules, which are non-negotiable for this project.

### Option D: `ts-results` instead of `neverthrow`

Both libraries are similar. `neverthrow` has a larger ecosystem, `ResultAsync` built in, and a more active maintainer history. Either would work; `neverthrow` was chosen first and the decision is stable.

## References

- [Objective 1: Repository & Tooling](../../objectives/01-repository-and-tooling.md)
- [Turborepo documentation](https://turbo.build)
- [dependency-cruiser rules](../../.dependency-cruiser.cjs)
- [neverthrow](https://github.com/supermacro/neverthrow)
