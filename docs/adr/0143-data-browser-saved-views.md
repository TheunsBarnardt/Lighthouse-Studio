# ADR-0143: Saved Views in Data Browser

**Status:** Accepted
**Date:** 2026-05-07
**Deciders:** solo

## Context

Power users of the data browser frequently apply the same configuration to the same table: a specific set of filters to show only active records, a particular sort order, a curated subset of columns. Recreating this configuration on each visit is friction. The configuration can be complex — a deeply nested filter AST with multiple conditions, several sort keys, and a specific column ordering.

Additionally, team members often need to share a specific "view" of data with colleagues (e.g., "here are all the overdue orders"). Without saved views, this requires either instructing the colleague to manually recreate the configuration or embedding a very long URL containing the serialised filter state.

Saved views must be workspace-scoped to respect the platform's tenancy model, and must integrate with the URL-based navigation model so that shared links are useful.

## Decision

Users can save named views per `(workspace, schema, table)` triple. A saved view captures the complete grid configuration:

- **Filter AST**: the structured filter tree (using the platform's standard filter AST format, ADR-0007)
- **Sort configuration**: ordered list of `(column, direction)` pairs
- **Visible columns**: which columns are shown, in what order
- **Page size**: the configured rows-per-page value

Views are stored in a `data_browser_views` table in the platform's internal schema, scoped to `workspace_id`. The view record includes:

- `id` (UUID v7)
- `workspace_id`
- `schema_name`
- `table_name`
- `name` (user-supplied, max 100 chars)
- `config` (JSONB): the serialised filter AST, sort, columns, page size
- `is_shared` (boolean): if `true`, all workspace members can read; if `false`, owner-only
- `owner_user_id`
- `schema_hash`: a hash of the table's column list at save time, used to detect schema drift
- `created_at`, `updated_at`

Views are applied to the grid by URL parameter: `?view=<id>`. This makes shared views linkable. When a user navigates to a URL containing `?view=<id>`, the grid loads the view's configuration and applies it as the initial state.

**Schema drift detection:** When the grid loads a saved view, it compares the stored `schema_hash` against the current table schema. If columns referenced in the view's filter AST or column list no longer exist (due to rename or deletion), the grid shows a warning banner: "This view references columns that no longer exist. [Edit view]". The view is still applied as best-effort (valid columns are applied; missing columns are skipped).

**Access control:** Private views (`is_shared = false`) are visible only to the owner. If a non-owner navigates to a URL containing a private view ID, the view parameter is ignored and the grid loads with default configuration. A dismissible info banner explains: "This view is private or does not exist."

## Consequences

### Positive

- Eliminates repeated manual reconfiguration for power users.
- URL sharing works for shared views — teammates can receive a link and see exactly the same filtered/sorted grid.
- Schema drift is surfaced proactively rather than silently misapplied.
- The feature is purely additive — users who never use views are unaffected.

### Negative

- Private views silently fall back to defaults when accessed by non-owners via URL. This could confuse users who share a private view link before toggling it to shared.
- Views become stale when the table schema changes. The drift detection mitigates this but requires user action to resolve.
- View storage is workspace-scoped — a view cannot be shared across workspaces. This is intentional (tenancy boundary) but may be surprising to installation admins who manage multiple workspaces.

### Neutral

- Views do not capture the active page cursor. Navigating to a view URL always starts at page 1 (or the first cursor position) with the view's filter and sort applied.
- The `schema_hash` is a hash of column names and types only; it does not include constraint or index changes. A column rename will trigger drift detection; adding an index will not.

## Alternatives Considered

### Option A: Browser localStorage for view persistence

Store the user's current grid configuration in the browser's `localStorage` and restore it on next visit.

**Rejected:** Not shareable across devices or users. Not durable (cleared by browser storage eviction). Cannot be shared via URL. Does not support the "shared view" use case at all.

### Option B: URL-only state (no server storage)

Serialise the entire view configuration (filter AST, sort, columns) into the URL as a query parameter.

**Rejected:** URLs become very long for complex filter ASTs (easily 500+ characters), making them impractical to share via email or Slack. URL parameters are also fragile — truncation or encoding errors corrupt the state silently. Server-stored views with a short ID are far more robust.

### Option C: Global (cross-workspace) views

Allow views to be saved at the installation level and applied across workspaces.

**Rejected:** This would require resolving view configurations against potentially different schemas in different workspaces (the same table name might have different columns in workspace A vs workspace B). It also violates the workspace tenancy boundary (ADR-0050). Cross-workspace sharing is out of scope for this feature.

## References

- ADR-0007: Filter AST
- ADR-0050: Workspace as tenancy unit
- ADR-0235: TanStack Table for data browser grid
- ADR-0240: Saved views as first-class objects
- Objective 18: Data Browser
