# ADR-0239: FK Batched Lookup for Foreign Key Cells

**Status:** Accepted
**Date:** 2026-05-06
**Objective:** 18 (Data Browser & Editor)

---

## Context

A table with foreign key columns shows raw UUIDs by default, which is unusable. The browser needs to resolve UUIDs to display values (e.g., show "Alice Smith" instead of `abc-123-...`). With 50 rows on screen and 3 FK columns, a naïve approach would fire 150 individual requests.

---

## Decision

**Batched lookup per FK column per page render.** When a page of rows loads:

1. For each FK column, collect all unique IDs visible on the page.
2. Send a single POST to `/api/v1/data/{ws}/schemas/{slug}/fk-resolve` with `{ columnId, targetTableId, ids: [...] }`.
3. The server responds with `{ resolved: { "<id>": "<displayValue>", ... } }`.
4. Results are cached in component state for the duration of the page session (`fkLabels` map).

Display column heuristic: the resolver tries `name`, then `title`, then `email` columns on the target table. The schema can override this via a `displayColumn` field on the FK definition.

**FK edit (combobox):** When editing a FK cell, a debounced search fires against the target table with a partial match filter. Results appear as a dropdown; the user picks, and the selected row's `id` is stored.

---

## Consequences

**What becomes easier:**

- N+1 query problem is completely avoided — maximum one request per FK column per page.
- Cache avoids re-fetching the same IDs across multiple page renders.
- FK editing is user-friendly: search by name, store ID.

**What becomes harder:**

- The `/fk-resolve` endpoint must be added to the API layer (Objective 12 extension).
- Very large IN lists (500 IDs) may be slow depending on the index situation; the `BROWSER_DEFAULTS.PAGE_SIZE` cap of 500 bounds this.

---

## Alternatives Considered

- **Eager join at the API layer:** The REST API returns resolved FK values inline. Cleaner but requires schema-aware joins in the generic list endpoint. Deferred to future optimization.
- **Client-side cache across sessions (localStorage):** Risk of stale labels if the referenced row's display column changes. Rejected: session-scoped cache is simpler and correct.
- **Lazy fetch per cell (on hover/focus):** Simpler but creates N requests as rows scroll into view. Rejected: UX lag.
