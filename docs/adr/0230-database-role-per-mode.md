# ADR-0230: Database Role per Console Mode

**Status:** Accepted
**Date:** 2026-05-05

## Context

The query console operates in two modes: read-only and console writer. Defense-in-depth requires that the database itself enforces the access boundary, not just the application layer. If the application classifier is bypassed or produces a false classification, the database should still reject the write.

## Decision

Two additional per-workspace database roles are provisioned at workspace creation time:

- `cust_<slug>_readonly` — SELECT privileges only on the workspace schema
- `cust_<slug>_console_writer` — SELECT + DML (INSERT, UPDATE, DELETE) privileges; no DDL

The query console connects using the role matching the classified operation mode. This provides two independent enforcement layers: the application-layer classifier and the database role.

## Consequences

- DB-level enforcement survives classifier bugs or future code changes
- Role provisioning adds two more `CREATE ROLE` and `GRANT` statements to workspace setup DDL
- Role teardown must drop all four roles (app, migrate, readonly, console_writer) on workspace deletion
- Connection pools are keyed by role — a pool-per-role map is required rather than a shared pool

## Alternatives Considered

**Single connection role with application-enforced limits:** Rejected — offers no defense-in-depth; a classifier bug or injection would have full DML access.

**Row-level security instead of roles:** Complementary, not a replacement — RLS controls row visibility, not statement type. Both can coexist.
