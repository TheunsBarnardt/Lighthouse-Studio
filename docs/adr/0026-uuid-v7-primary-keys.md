# ADR-0026: UUID v7 as Primary Keys

**Status:** Accepted
**Date:** 2026-05-02
**Deciders:** solo

## Context

The platform supports three databases (Postgres, MSSQL, MongoDB). Primary key strategy must work on all three without platform-specific magic (no SERIAL/IDENTITY, no ObjectId).

UUID v4 (random) is the go-to, but its random bit pattern causes B-tree index fragmentation: each new row lands in an arbitrary position rather than at the end of the index leaf page. At millions of rows, this causes index bloat and poor write performance due to page splits.

UUID v7 encodes a timestamp in the most-significant bits, making it time-ordered. New rows append to the end of the index, dramatically reducing fragmentation.

## Decision

Use UUID v7 (`uuidv7` npm package) for all primary keys across all entity tables, on all three databases.

The `standardColumns` helper in `src/schema/_common.ts` uses `$defaultFn(() => uuidv7())` so that every entity gets a v7 UUID by default when created via the Drizzle schema.

The `createPostgresRepository` adapter receives the entity's `id` from the service layer (which has already assigned the UUID), so the database default is a backup; the application always controls the ID.

## Consequences

### Positive

- Time-ordered: `ORDER BY id` approximates chronological order, useful for pagination and debugging.
- B-tree-friendly: sequential inserts; no page splitting in healthy write patterns.
- Works on Postgres, MSSQL, and MongoDB without database-specific code.
- Universally unique without coordination — no sequence or auto-increment needed.
- Human-readable prefix: the first 12 hex characters encode the timestamp in hex; you can roughly date a record by reading its ID.

### Negative

- UUID v7 is not yet part of the SQL standard (though it is widely supported in ORMs and generators).
- Slightly more bytes than an integer primary key (16 bytes vs 4 or 8). Acceptable for platform scale.
- `uuidv7` package adds a dependency. It's tiny (< 2 KB), MIT-licensed, and has no sub-dependencies.

### Neutral

- Postgres natively stores UUID as 16 bytes (not as a string), so there's no storage penalty compared to a v4 UUID.
- MongoDB stores it as a Binary(16) subtype 4 (UUID).

## Alternatives Considered

### UUID v4 (random)

Pros: trivially available everywhere.
Cons: random insertion causes B-tree fragmentation. Rejected in favour of v7.

### ULID

Pros: also time-ordered; URL-safe base32 string representation.
Cons: not a UUID format; some databases/ORMs require workarounds. UUID v7 achieves the same ordering properties in standard UUID format.

### Integer SERIAL / IDENTITY

Pros: smallest, fastest.
Cons: requires coordination (sequences); not universal across databases without extra plumbing; not compatible with the platform's multi-database model.

### CUID2

Pros: collision-resistant.
Cons: not a UUID format; no time ordering.

## References

- `packages/adapters/persistence-postgres/src/schema/_common.ts`
- [UUID v7 spec (RFC 9562)](https://www.rfc-editor.org/rfc/rfc9562)
- [uuidv7 npm package](https://www.npmjs.com/package/uuidv7)
