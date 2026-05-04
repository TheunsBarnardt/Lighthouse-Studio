# ADR-0104: Bulk Operations with Bounded Sizes

**Status:** Accepted
**Date:** 2026-05-03
**Deciders:** solo

## Context

The auto-generated API must support bulk operations: creating many rows at once, updating all rows matching a filter, deleting all rows matching a filter. Without bounds, a single API call could:

- Lock a table for seconds or minutes (bulk delete of 10M rows)
- Consume all available memory in the application server (loading 1M rows to return)
- Exhaust the database's transaction log (a million-row update in one transaction)
- Trigger timeouts on the client, leaving the server operation partially complete

Operators need a predictable, bounded system they can reason about. Customers need the ability to process large datasets without hitting arbitrary invisible limits.

## Decision

All bulk operations are bounded by explicit, documented limits.

**Bulk create** (`POST /<table>/bulk`):

- Maximum 1000 rows per request.
- Validated at the API layer before any I/O.
- Wrapped in a single transaction: all succeed or all fail.
- Returns the created rows (with server-assigned IDs) in the response.
- Exceeding 1000 rows returns `400 Bad Request` with a clear error message.

**Bulk update by filter** (`PATCH /<table>?filter=...`):

- Default max affected rows: 10,000.
- Configurable per workspace (workspace admin can raise to a hard cap of 100,000).
- The `Max-Affected-Rows` header can reduce (not raise) the limit per request.
- If the filter would affect more rows than the limit, returns `422 Unprocessable Entity` with the actual count.
- Emits ONE audit event with the filter, count, and changes — not one per row.

**Bulk delete by filter** (`DELETE /<table>?filter=...`):

- Same limits as bulk update.
- Hard delete requires the `data_table.hard_delete` permission (separate from `data_table.delete` for soft-delete).

For operations larger than these limits, customers use the data export/import paths (Objective 15) or script multiple bounded API calls.

## Consequences

**What becomes easier:**

- Operators can predict the worst-case impact of any API call.
- A runaway client bug (accidentally passing an empty filter to bulk delete) is bounded — it cannot delete more than the configured limit.
- Database transactions stay within a manageable size; no risk of transaction log exhaustion.
- The audit trail is readable: one event per bulk operation (with count) rather than millions of individual row events.

**What becomes harder:**

- Customers with legitimate large-batch needs (e.g., importing 50,000 rows) must script multiple calls. This is intentional: the platform's recommended path for large imports is the dedicated import endpoint (Objective 18), not the bulk API.
- The 10,000-row update limit may feel restrictive to some customers. The workspace-admin-adjustable cap provides the escape valve without removing the protection entirely.

## Alternatives Considered

**Unbounded bulk operations:** Rejected. A 10M-row delete in production is a database incident. The platform cannot expose this risk.

**Server-side streaming for large operations (chunking internally):** The API could accept an "unlimited" request and chunk it internally. Rejected because it makes the operation non-atomic (partial failures mid-stream), makes progress reporting complex, and moves the operational risk inside the platform rather than outside. Explicit chunking by the client is simpler and more transparent.

**Per-row limits with automatic pagination (chunked cursor):** Considered for bulk update; rejected as too complex to specify and verify. The explicit `Max-Affected-Rows` limit is a simpler invariant.
