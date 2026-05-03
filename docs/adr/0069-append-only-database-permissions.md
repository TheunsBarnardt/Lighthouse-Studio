# ADR-0069: Append-Only Database Permissions for Audit Log

**Status:** Accepted
**Date:** 2026-05-02
**Deciders:** solo

## Context

The audit log's value depends on its integrity. An audit log that can be modified (via the application, via SQL injection, or via a compromised service account) provides weaker guarantees than one that cannot.

The hash chain (ADR-0068) detects modifications, but it does not prevent them. Defense in depth means we want to prevent modifications at the database permission level, so that even a successful SQL injection through the application cannot delete or update audit rows.

We have three database users in the platform's model:

- `app_user`: the application's runtime database user
- `migrate_user`: the migration runner (DDL and DML)
- `audit_retention_user`: the scheduled retention enforcement job

The question is: what privileges should each have on `audit_log` and `audit_chain_state`?

## Decision

Grant only the minimum necessary permissions on audit tables to each database user:

**`app_user`:**

- `audit_log`: SELECT, INSERT only. No UPDATE, no DELETE.
- `audit_chain_state`: SELECT, UPDATE only (must update `last_hash` on each insert). No INSERT, no DELETE.

Enforced via explicit DENY (MSSQL), REVOKE (PostgreSQL), and application-layer permission checks (MongoDB where native DENY is less expressive).

**`migrate_user`:**

- Full DDL and DML (CREATE TABLE, ALTER TABLE, INSERT, UPDATE, DELETE, DROP)
- Needed only during migrations; should not be used by the running application

**`audit_retention_user`:**

- `audit_log`: SELECT, DELETE only (for enforcing retention cutoffs)
- `audit_chain_state`: SELECT only
- This user is used only by the scheduled retention enforcement job

**Result:** Even if an attacker gains control of the application process (via a vulnerability), they cannot delete audit rows through `app_user`. The hash chain provides a second layer of detection; the permission model provides the first.

## Consequences

### Positive

- SQL injection via the application cannot delete or update audit records.
- A compromised application account cannot cover its tracks.
- Defense in depth: two independent mechanisms (permissions + hash chain) must both be defeated to successfully tamper with the audit log undetected.
- Each database user follows the principle of least privilege.

### Negative

- Schema changes to `audit_log` require running as `migrate_user`, which cannot be done at application runtime. This is intentional: schema changes are deliberate operations.
- On MongoDB, native DENY/REVOKE semantics are less expressive than on relational databases. The platform uses a dedicated database user with restricted collection-level permissions, which is the closest MongoDB equivalent.
- The `audit_retention_user` is a separate credential to manage. Adding it increases operational complexity slightly.

### Neutral

- The application's `audit_chain_state` UPDATE permission is the narrowest window where the application can modify existing rows. It can only write `last_hash` and `last_sequence` — not event content.
- PostgreSQL's row-level security (RLS) can be used to further restrict `audit_retention_user` to only delete rows older than a configurable cutoff, providing an additional guard on retention enforcement.

## Alternatives Considered

### Option A: Give app_user full DML on audit tables

Simpler setup; no dedicated retention user. Rejected because it allows the application (and any SQL injection vulnerability in it) to delete or modify audit rows. The audit log's integrity guarantee would rest entirely on application-level controls, which is insufficient for enterprise trust.

### Option B: Separate audit database

Stronger isolation; the audit database can be on a different host with separate credentials. Rejected as too operationally complex for the self-hosted model. Customers who want stronger isolation can use the cold archive (ADR-0074) option.

## References

- [ADR-0068: Hash-Chained Audit Log](./0068-hash-chained-audit-log.md)
- `packages/adapters/persistence-postgres/migrations/0002_audit_log.sql` — permission grants
- `packages/adapters/persistence-mssql/migrations/0002_audit_log.sql` — DENY statements
- `docs/compliance/threat-model.md` — Tampering threat analysis
