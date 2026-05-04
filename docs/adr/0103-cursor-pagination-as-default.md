# ADR-0103: Cursor Pagination as Default

**Status:** Accepted
**Date:** 2026-05-03
**Deciders:** solo

## Context

The auto-generated REST API's `list` endpoints need a pagination strategy. Customer tables may have millions of rows. Two strategies exist:

1. **Offset pagination**: `?offset=N&limit=M` → `OFFSET N LIMIT M` (SQL) or `skip(N).limit(M)` (Mongo).
2. **Cursor pagination**: `?cursor=<opaque>&limit=M` → `WHERE pk > cursor_value LIMIT M`.

Both must be supported for compatibility, but the SDK and documentation must recommend one as the default.

## Decision

**Cursor pagination is the default**; offset is supported but not recommended.

Cursor implementation:

- Default sort: primary key ascending (UUID v7 is time-ordered; natural insertion order).
- Cursor value: the primary key value of the last row in the current page, base64url-encoded.
- Next page: `WHERE pk > decoded_cursor_value ORDER BY pk LIMIT N`.
- Bidirectional: `nextCursor` and `prevCursor` are both returned in `meta`.
- The cursor is opaque to clients; they pass it back unchanged.

Offset implementation:

- Supported via `?offset=N&limit=M`.
- Documented as "use for ad-hoc exploration; avoid for production pagination over large tables."
- A warning header `X-Pagination-Performance-Warning` is added when `offset > 1000`.
- The SDK uses cursor by default; offset is available as an explicit option.

## Consequences

**What becomes easier:**

- Cursor pagination is O(log N) on all three databases (Postgres, MSSQL, Mongo) regardless of how deep into the result set the client is.
- No duplicate or missing rows when rows are inserted between page fetches (stable cursor anchor).
- Works identically across all three databases; no capability difference.

**What becomes harder:**

- Cursor pagination requires a stable sort order. If the customer requests an arbitrary sort (e.g., `?sort=name`), the cursor must encode both the sort field value AND the primary key as a tiebreaker. The implementation must handle this.
- Clients cannot jump to page N directly (random access). They must paginate forward from the beginning. This is intentional — random access requires offset, which is slow at scale.
- The cursor is opaque; clients cannot construct one manually (by design; prevents injection).

## Alternatives Considered

**Offset-only:** Simple to implement and intuitive for developers. Performance degrades linearly past ~10k rows on all databases. A 100k-row table with `?offset=99000` reads and discards 99,000 rows on every database. Unacceptable for production-scale customer tables.

**Keyset pagination (same as cursor, different name):** This is what we're implementing. "Cursor pagination" and "keyset pagination" are the same technique; "cursor" is the more common API term.

**Page-token pagination (Google API style):** Functionally equivalent to cursor pagination. We use "cursor" because it's a more descriptive term for developers unfamiliar with pagination internals.
