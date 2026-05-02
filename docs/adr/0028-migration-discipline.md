# ADR-0028: Migration Discipline

**Status:** Accepted
**Date:** 2026-05-02
**Deciders:** solo

## Context

Schema migrations are one of the riskiest operations in production software. Common failure modes:

- Long-running DDL that holds table locks, blocking reads and writes for minutes.
- Migrations that cannot be rolled back after a failed deployment.
- Tampered migration files that produce inconsistent databases across environments.
- Migrations applied out of order, leaving the schema in an unexpected state.

The platform needs a migration discipline that is safe, reviewable, reversible, and verifiable.

## Decision

### Toolchain

- **Authoring**: `drizzle-kit generate` diffs the TypeScript schema and produces plain SQL. Developers review and edit the generated SQL before committing.
- **Execution**: A custom migration runner (`src/migrate.ts`) applies migrations, not `drizzle-kit migrate`. The custom runner adds checksum verification that drizzle-kit's built-in runner does not.

### Storage

Migrations live in `packages/adapters/persistence-postgres/migrations/` as plain `.sql` files. The `_journal.json` tracks ordering. Everything is committed to git.

Every migration has a companion `.down.sql` for rollback. Down migrations are tested in CI.

### Tracking

The `__platform_migrations` table in the database tracks applied migrations with their SHA-256 checksums. On each run:

1. The runner computes the checksum of each `.sql` file.
2. For already-applied migrations, the runner verifies the checksum matches what was recorded.
3. If any checksum mismatches, the runner aborts with a clear error — the migration file has been tampered with.

Tampering protection prevents the "fix it in place" anti-pattern. If a migration has a bug after it's been applied, the correct response is a new fix-forward migration.

### Naming

Migration files are named `NNNN_descriptive_name.sql`, where NNNN is a zero-padded sequence number. The name must describe the change: `0042_add_artifact_reasoning_column.sql`, not `0042_changes.sql`.

### Promotion gates

| Environment | Migration trigger         | Gate                                                     |
| ----------- | ------------------------- | -------------------------------------------------------- |
| Dev         | Automatic on merge to dev | None                                                     |
| Staging     | Manual approval in CI     | Requires staging Postgres backup snapshot                |
| Production  | Manual approval in CI     | Requires prod backup + staging migration in previous run |

A failed migration auto-rolls back if the SQL is in a transaction. If it cannot roll back, the deployment halts and the "stuck migration" runbook applies.

### Guidelines for safe migrations

- Use `IF NOT EXISTS` / `IF EXISTS` for idempotent DDL.
- For large tables: use `CREATE INDEX CONCURRENTLY` instead of inline indexes.
- For NOT NULL addition to large tables: add the column as nullable first, backfill, then add the NOT NULL constraint (separate migrations).
- Data migrations are separate from DDL migrations: DDL first, then data, then any cleanup DDL.
- Never run DDL in production without a backup snapshot first (enforced by the staging/prod gate).

## Consequences

### Positive

- Tamper detection ensures every environment applies identical SQL.
- Plain-SQL migrations are readable by any DBA, not just platform developers.
- Fix-forward discipline (never editing applied migrations) keeps history clean.
- Promotion gates ensure staging proves migrations before production applies them.

### Negative

- More ceremony than `drizzle-kit migrate` alone. Developers must understand the custom runner.
- Down migrations require effort to author and test. They are required; there is no bypass.
- Sequential numbering requires coordination (no parallel branches creating migrations with the same number). Handled by convention and code review.

### Neutral

- The migration runner is a standalone TypeScript script (`tsx src/migrate.ts`), usable both in CI and locally.
- The `_journal.json` is used by drizzle-kit's UI tools for visibility; the custom runner reads it for ordering.

## Alternatives Considered

### drizzle-kit migrate (built-in runner)

No checksum verification; no custom promotion gates; harder to extend. Rejected in favour of the custom runner that adds the safety properties needed.

### Flyway / Liquibase

Mature, feature-rich. Too heavy (JVM dependency) for a Node.js platform. The platform's needs are met by the lighter custom runner.

### No down migrations

Simpler. Rejected because rollback capability is non-negotiable for the staging and production gates.

## References

- `packages/adapters/persistence-postgres/src/migrate.ts`
- `packages/adapters/persistence-postgres/migrations/`
- `docs/runbooks/postgres-migration-stuck.md`
- `docs/runbooks/postgres-restore.md`
