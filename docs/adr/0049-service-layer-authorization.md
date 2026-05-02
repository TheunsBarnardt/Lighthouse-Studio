---
adr: 0049
title: Service-Layer Authorization — Not Database RLS
status: Accepted
date: 2026-05-02
deciders: Theuns Barnardt
objective: objectives/06-multi-tenancy-rbac.md
---

## Context

The platform supports three databases: PostgreSQL, MSSQL, and MongoDB. PostgreSQL has Row-Level Security (RLS) as a native feature. MSSQL has a weaker equivalent. MongoDB has no RLS at all.

If we enforce access control at the database layer (RLS), we get it for free on Postgres but must re-implement it differently on MSSQL and not at all on Mongo. The three adapters would have divergent security postures.

## Decision

**Authorization is enforced at the service layer**, not the database layer. Every service method calls `authz.authorize(ctx, action, resource)` before any persistence operation. This call goes through `AuthorizationPort`, which is implemented by the `authz-builtin` adapter.

No database-level RLS is used, even on Postgres. This is an explicit choice: it keeps the security model uniform across all three databases.

## Consequences

- Authorization logic is written once and works identically on all three databases
- Authorization code is in TypeScript, making it auditable, testable, and debuggable
- Service-layer authorization can be independently tested without a database
- A mistake in service code (forgetting `authorize()`) is detectable via linter rule and code review; a missing RLS policy requires database-level tooling to detect
- Performance: service-layer auth adds a network round-trip to the DB to load permissions; mitigated by per-request caching (ADR-0055)

## Alternatives Considered

**Postgres RLS only**: Works on Postgres but leaves MSSQL and Mongo without equivalent protection. Divergent security postures are a compliance risk.

**Middleware-level (e.g., HTTP layer)**: Too coarse — doesn't protect inter-service calls, background workers, or direct SDK usage.
