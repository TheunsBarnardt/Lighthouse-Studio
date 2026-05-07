# ADR-0188: Sandboxed JS Expressions for Custom Transformations

**Status:** Accepted
**Date:** 2026-05-07
**Objective:** 25 — Stage 5: Data Migration

## Context

The built-in transformation library covers most cases, but some migrations need custom logic (e.g., parsing a proprietary date format, mapping enum values). The question is how to allow custom logic without introducing security risks.

## Decision

Custom transformations use small JavaScript expressions executed in a sandbox:
- Browser-side preview: Web Worker isolation
- Server-side execution: vm2-style sandbox with no I/O
- Available globals: Math, Date, JSON, console (for warnings only)
- Time-bounded: 100ms per row default
- Blocked: fetch, XMLHttpRequest, require, import, eval, Function constructor

The sandbox is audited as part of Objective 10's security review. Expressions are validated at edit time for obvious disallowed patterns (eval, fetch, etc.) before saving.

## Consequences

- Users can handle cases the built-in library doesn't cover.
- The sandbox is the security frontier; any escape would give users access to the platform runtime.
- Server-side vm2 (or equivalent) is a well-tested library; auditing the surface is feasible.
- 100ms time limit prevents infinite loops from blocking the migration worker.
- Complex business logic in custom expressions is an anti-pattern (better to transform the source before migrating); document this in the guide.

## Alternatives Considered

- **No custom expressions**: too limiting; some proprietary formats require custom parsing.
- **Arbitrary code via process isolation**: stronger security but much higher infrastructure cost per migration row.
- **SQL expressions**: database-specific; not portable across source types.
