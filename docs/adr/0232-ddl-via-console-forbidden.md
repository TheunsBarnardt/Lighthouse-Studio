# ADR-0232: DDL via Console Forbidden

**Status:** Accepted
**Date:** 2026-05-05

## Context

The query console gives direct database access. Without a DDL restriction, users could bypass the Schema Designer entirely, creating tables without schema records, breaking the migration history, invalidating the API surface, and circumventing the approval workflow for schema changes.

## Decision

DDL statements (CREATE TABLE, ALTER TABLE, DROP, TRUNCATE, CREATE INDEX, CREATE FUNCTION, GRANT, REVOKE, etc.) are forbidden in the query console regardless of the user's permissions. The classifier identifies DDL via AST node types (Postgres) or statement types (MSSQL) and returns a `FORBIDDEN` error with a message directing the user to the Schema Designer.

The `cust_<slug>_console_writer` database role does not have DDL privileges, providing a second enforcement layer.

## Consequences

- Schema changes remain version-controlled and auditable through the Schema Designer
- The approval workflow for schema changes cannot be circumvented via console
- Power users who genuinely need DDL access must use the Schema Designer or direct database access via their own credentials (outside the platform)
- Error messages are specific: "Use the Schema Designer to make schema changes"

## Alternatives Considered

**Allow DDL with a separate `query.ddl` permission:** Rejected — DDL changes must go through versioned schema management to maintain integrity of the migration history and API surface.

**Warn instead of block:** Rejected — a warning that can be bypassed provides no real protection.
