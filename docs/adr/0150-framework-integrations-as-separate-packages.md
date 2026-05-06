# ADR-0150: Framework Integrations as Separate Packages

**Status:** Accepted
**Date:** 2026-05-06
**Objective:** 19 (Public SDK)

## Context

The core SDK (`@platform/sdk`) is designed to work in any runtime. React and Vue have their own state management primitives (hooks, composables, reactive refs) that integrate with framework lifecycle. A decision is needed on whether to include framework integrations in the core SDK or publish them as separate packages.

## Decision

Framework integrations are separate packages:

- `@platform/sdk-react` — React hooks (useQuery, useMutation, useRealtime, useAuth, useUpload)
- `@platform/sdk-vue` — Vue 3 composables (useQuery, useMutation, useRealtime, useAuth, useUpload)

Each framework package:

- Declares `react`/`vue` and `@tanstack/react-query`/`@tanstack/vue-query` as peer dependencies
- Depends on `@platform/sdk` for the underlying clients
- Has its own independent build with the framework as an external

The core `@platform/sdk` has zero framework dependencies. It works in vanilla JavaScript, Angular, Svelte, SolidJS, and any other runtime without pulling in React or Vue.

## Rationale

1. **No accidental bundling:** A Node.js backend project using `@platform/sdk` for data access should not have React in its dependency tree
2. **Framework version flexibility:** `@platform/sdk-react` can support React 18 and React 19 through peer dependency ranges without the core SDK needing to change
3. **Community extensions:** Third-party packages (e.g., `@platform/sdk-angular`, `@platform/sdk-solid`) can be built against the core SDK without forking; same pattern as TanStack Query's framework adapters
4. **Bundle hygiene:** The React package is < 50 KB budget independently from the core < 30 KB budget; each is optimized separately

## Consequences

**Easier:**

- Core SDK can evolve independently of framework release cycles
- Angular, Svelte, SolidJS, etc. can build community integration packages
- Pure-Node.js users don't pay for React/Vue peer dependencies

**Harder:**

- Two packages to install for React/Vue users (`@platform/sdk` + `@platform/sdk-react`)
- Breaking changes to core SDK interfaces require coordinated updates in framework packages
- Version mismatches between core and framework packages must be managed carefully

**Alternatives considered:**

- **All in one package with optional React/Vue code:** Simpler installation; rejected — impossible to tree-shake peer dependencies correctly; all users get React types even if using Vue
- **No framework integrations:** Customers implement their own hooks; rejected — reduces DX significantly; TanStack Query integration is non-trivial to get right (query key stability, realtime integration)
