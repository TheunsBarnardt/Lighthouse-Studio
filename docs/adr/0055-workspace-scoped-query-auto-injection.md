---
adr: 0055
title: Workspace-Scoped Query Auto-Injection via bindToContext
status: Accepted
date: 2026-05-02
deciders: Theuns Barnardt
objective: objectives/06-multi-tenancy-rbac.md
---

## Context

The platform's worst failure mode is cross-workspace data leakage: user in workspace A reads data belonging to workspace B. This can happen if a developer forgets to add a `workspace_id` filter to a query.

With three databases and no RLS (ADR-0049), this filter must be added in application code. The question is: how do we ensure it is never forgotten?

## Decision

**`bindToContext()` wraps any `RepositoryPort<T>` and automatically injects `workspace_id = ctx.workspaceId` into every query.** Service code uses the bound repository; it cannot issue unscoped queries even accidentally.

```typescript
const scopedProjects = bindToContext(projectRepo, ctx);
// Every findById, findOne, findMany, update, archive, hardDelete
// automatically filters to ctx.workspaceId.
// create() verifies entity.workspaceId matches ctx.workspaceId.
```

If `ctx.workspaceId` is absent, `bindToContext` returns a repo that rejects all operations with a `PersistenceError`. This makes forgetting the workspace context a runtime error that fails fast in tests, not a silent data leak in production.

Repository operations that genuinely span workspaces (installation-level admin queries) use the raw (unbound) repo after an explicit installation-role check.

## Consequences

- Workspace scoping is mechanical, not remembered
- Forgetting `workspaceId` in context produces an error in tests before reaching production
- Cross-workspace reads are structurally impossible through the bound repo
- Property-based leak tests (`leak-tests/cross-tenant-isolation.test.ts`) verify this on every PR
- Developers cannot accidentally expose unscoped data even if they bypass the authorization check (defense in depth)

## Alternatives Considered

**Convention (comment in code, code review)**: Insufficient. Conventions break under time pressure.

**Linter rule checking filter presence**: Too brittle; would require analyzing complex filter types.

**Database RLS**: Does not work uniformly on all three databases (ADR-0049).
