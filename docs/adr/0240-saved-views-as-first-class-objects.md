# ADR-0240: Saved Views as First-Class Database Objects

**Status:** Accepted
**Date:** 2026-05-06
**Objective:** 18 (Data Browser & Editor)

---

## Context

Users frequently look at the same table with the same filter/sort combination (e.g., "active users", "overdue invoices"). Without saved views, they must re-build these configurations each session. Views need to be shareable (so teams see the same default configurations) and URL-persistent (so a link opens the same view).

---

## Decision

Saved views are stored in the `data_browser_views` table (migrated in 0012_data_browser.sql) and managed by `DataBrowserService`. Each view captures:

- `filter_config`: serialized Filter AST (same format as the API's `?filter=` parameter)
- `sort_config`: ordered list of `{ columnId, direction }` tuples
- `visible_columns`: ordered list of visible column IDs (for future column visibility toggles)
- `shared`: boolean; when true, all workspace members can see the view

**URL persistence:** The active view ID (and table ID) are stored in the URL query string (`?table=X&view=Y`). Sharing the URL shares the view configuration. The viewer runs queries with their own permissions — a shared view cannot elevate permissions.

**CRUD:** `DataBrowserService` provides `listViews`, `getView`, `createView`, `updateView`, `deleteView`. Only the creator can update or delete their own views. Shared views are readable by all workspace members with `browser.read` permission.

---

## Consequences

**What becomes easier:**

- Teams converge on standard views without each member re-configuring.
- URLs are shareable and bookmarkable.
- View definitions are audited (create/update/delete/share events).

**What becomes harder:**

- The `visible_columns` feature (column visibility toggles) is captured in the schema but not yet surfaced in the UI. It will be a natural extension when column toggle UI is added.
- Users with many tables × many views may accumulate a lot of views; a future "view management" page may be needed.

---

## Alternatives Considered

- **URL-only persistence (no database):** Views would be shareable via URL but not listable/manageable. Rejected: teams need a view picker, not URL archaeology.
- **User preferences in localStorage:** Not shareable. Rejected.
- **Views as part of the schema definition:** Too heavyweight; schema changes are audited deployments. Views are runtime configuration. Rejected.
