# ADR-0229: Read-Only by Default with Explicit Write Permission

**Status:** Accepted
**Date:** 2026-05-05

## Context

The query console allows users to execute raw SQL and MongoDB aggregation pipelines directly against workspace databases. Without safety rails, any user with console access could accidentally or maliciously destroy data. The platform must balance developer productivity (direct DB access) with data safety.

## Decision

The query console operates in read-only mode by default. Any query classified as a write operation (INSERT, UPDATE, DELETE, MERGE) requires the `query.write` permission, which is **not granted by default** to any built-in role. Workspace owners must explicitly grant `query.write` to roles that need it.

Additionally:
- Write queries require UI confirmation (`confirmed: true`) even when `query.write` is granted
- DDL statements (CREATE, ALTER, DROP, etc.) are forbidden in all modes — schema changes go through the Schema Designer
- EXPLAIN is always read-only regardless of the target query

## Consequences

- Safer default: accidental DELETE/UPDATE without `query.write` returns a clear `FORBIDDEN` error
- Audit trail: every `query.write` execution creates a separate audit event (`data_management.query.executed_write`)
- Friction for write operations is intentional — it surfaces during onboarding and teaches users the permission model
- Workspace admins who need DML access must explicitly opt in, creating a documented decision trail

## Alternatives Considered

**Allow writes by default, restrict on opt-out:** Rejected — too dangerous for multi-tenant shared environments; the first accidental mass-delete would eliminate trust in the platform.

**Separate "write console" as a distinct feature:** Rejected — adds UI complexity; a permission gate on the same UI is simpler and achieves the same safety outcome.
