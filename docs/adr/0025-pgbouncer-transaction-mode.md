# ADR-0025: PgBouncer in Transaction Mode

**Status:** Accepted
**Date:** 2026-05-02
**Deciders:** solo

## Context

Node.js application servers can open many concurrent Postgres connections, which is expensive (each connection forks a backend process). At 200 concurrent requests, a naïve setup creates 200 Postgres connections; a typical VPS can handle ~100 before degrading.

PgBouncer is the standard mitigation: it multiplexes many client connections onto a smaller pool of server connections. It has three modes:

- **Session mode**: one server connection per client session (no real multiplexing).
- **Transaction mode**: one server connection per transaction; released to the pool between transactions. Highest concurrency.
- **Statement mode**: one server connection per statement. Even higher concurrency but breaks multi-statement transactions.

## Decision

Run PgBouncer in **transaction mode** between the application and Postgres. This is the industry standard for Node.js services.

Maintain **two connection pools** in the application:

1. `pool` — connects through PgBouncer; used for all normal application queries.
2. `directPool` — connects directly to Postgres; used for migrations, DDL, `LISTEN/NOTIFY`, advisory locks, and any operation that requires session-level state.

The `directPool` is the safety valve for operations that PgBouncer transaction mode cannot handle.

## Consequences

### Positive

- Application connections are cheap: PgBouncer can multiplex 200 clients onto 20 server connections.
- Standard infrastructure that every Postgres DBA knows how to operate.
- PgBouncer's stats endpoint provides pool visibility.

### Negative

- Session-level `SET` statements (e.g., `SET statement_timeout`) do not persist across PgBouncer transaction boundaries. The platform relies on server-level `postgresql.conf` defaults (`statement_timeout=30000`) instead of per-connection setup.
- Prepared statements that span connections don't work in transaction mode. The platform uses unnamed parameterized queries via `pg` (which are safe).
- `LISTEN/NOTIFY` requires the `directPool`. This is documented and enforced by convention.
- `BEGIN/COMMIT` within a unit-of-work must use the `directPool` to get a session-stable connection; the UnitOfWork adapter does this.

### Neutral

- PgBouncer runs as a sidecar container in the Compose stack. Configuration is in `infra/docker/` Compose files.
- The `PGBOUNCER_SERVER_RESET_QUERY` is set to empty in transaction mode, which is correct.

## Alternatives Considered

### Session mode

Fewer restrictions but no multiplexing benefit. Defeated the purpose.

### No connection pooler (pg-pool only)

pg's built-in pool works but is process-local. Multiple worker processes create separate pools, each holding connections. With 4 workers × 10 connections = 40 connections. Still fine for early scale. Rejected because PgBouncer prevents surprises at higher concurrency and is easier to add now than under load.

### pgpool-II

More complex; adds query routing and load balancing. Overkill for this deployment model. PgBouncer is simpler and more reliable for connection pooling alone.

## References

- ADR-0002: Environment Strategy
- `packages/adapters/persistence-postgres/src/connection.ts`
- `infra/docker/local.yml`
- [PgBouncer FAQ](https://www.pgbouncer.org/faq.html)
