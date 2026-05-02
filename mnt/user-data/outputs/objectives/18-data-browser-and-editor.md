# Objective 18: Data Browser & Editor

**Status:** Ready for development
**Prerequisites:** Objectives 11 (Schema Designer), 12 (REST APIs), 14 (Realtime), 15 (Storage), 17 (Query Console — for advanced filter UX consistency) complete
**Blocks:** Objective 19 (Public SDK can reference the data browser as a primary user-facing feature)

---

## 1. Purpose

Build the **single most-used screen** in the Data Management Module — the table viewer, row editor, and bulk data manipulation surface that customers will spend hours in every day. This is what "the platform" looks like to most users.

The data browser is a spreadsheet-style interface over customer-defined tables, with:
- Live updates as data changes (via Objective 14's realtime layer)
- Inline cell editing with optimistic updates and conflict resolution
- Filtering, sorting, and pagination using the same Filter AST as the API
- CSV import/export for bulk data movement
- Special rendering for typed columns (file/image previews, foreign key resolution, dates, decimals)
- Bulk selection and bulk operations
- Permission-aware UI (rows the user can't edit appear read-only; cells they can't see show as redacted)

This is the equivalent of Supabase's table editor or Airtable's grid view. It's the screen that demos well, the screen that customers reach for first when exploring their data, the screen that shapes the perception of "is this platform actually pleasant to use."

This objective produces the **complete data browsing and editing experience**. By the end, a customer can install the platform, define a schema, populate it via CSV import, browse and edit rows in a polished UI with real-time collaboration, and export the data when needed.

---

## 2. Scope

### In Scope

- **Table viewer**: spreadsheet-style grid showing rows from any customer table
- **Inline cell editing** with appropriate input controls per column type
- **Filtering, sorting, pagination** using the existing API infrastructure
- **Bulk selection** (shift-click, ctrl-click, drag-select) and bulk actions
- **CSV/JSON import** with validation, preview, error reporting
- **CSV/JSON export** of filtered/visible rows or full table
- **Typed column rendering**:
  - Strings: text input/textarea
  - Numbers: numeric input
  - Booleans: checkbox
  - Dates: date/time picker
  - Decimals: numeric with precision
  - JSON: collapsible viewer + JSON editor
  - Arrays (where supported): chip-style editor
  - Files / images / videos: thumbnail with preview/upload via Objective 15
  - Foreign keys: resolved display ("Alice" instead of "abc-123-...") with picker
  - PII columns: respect redaction permission
- **Real-time updates**: live row changes from the change stream layer
- **Optimistic updates**: edits feel instant; rollback on conflict
- **Conflict resolution UI**: when two users edit the same row, the second sees the conflict with a clear merge/overwrite/discard choice
- **Row-level operations**: insert, duplicate, archive (soft-delete), restore, hard-delete
- **Schema awareness**: the browser knows what's required, what's nullable, what foreign keys exist
- **Permission-aware UI**: edit controls disabled where user lacks permission; cells redacted appropriately
- **Bookmarkable views**: filter + sort + column visibility saved as a "view"
- **Keyboard navigation**: full keyboard control (arrow keys, Enter to edit, Esc to cancel, Tab between cells)
- ADRs

### Out of Scope (Belongs to Later Objectives)

- Pivot tables / cross-tabulations (deferred; users export to spreadsheets for now)
- Charts / visualizations (deferred; Objective 19's SDK enables embedding charts in customer apps)
- Inline editing of related records (e.g., editing a foreign-keyed row from the parent table) — deferred
- Conditional formatting (cell colors based on rules) — deferred
- Cell formulas (Excel-style) — out of scope; the platform is a database UI, not a spreadsheet
- Aggregation rows ("show sum of column X") — basic count is here; sum/avg/min/max deferred
- Custom column types defined by the customer — deferred until the type system needs the extensibility
- Mobile-optimized experience — the data browser is desktop-first; mobile is best-effort

---

## 3. Locked Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Grid library | TanStack Table v8 (formerly react-table) | Industry standard; headless; keyboard-friendly; works with virtualization |
| Row virtualization | TanStack Virtual | Companion library; handles tens of thousands of rows efficiently |
| Cell edit pattern | Click to enter edit mode; Enter or Tab to save; Esc to cancel | Spreadsheet-standard; familiar |
| Save trigger | On blur (cell loses focus) — saves; explicit "Save" button on row for "stay in edit mode multiple cells" | Common pattern from Notion, Airtable |
| Optimistic updates | Yes — UI shows the new value immediately; reverts on server error | Feels fast |
| Conflict resolution | Modal on conflict — show local change, server change, allow merge or discard | User-driven; honest |
| Filter UX | Same Filter AST as API; UI generates from column types (e.g., date pickers for date columns) | Consistency |
| Sort UX | Click column header; multi-column via shift-click | Standard |
| CSV import library | papaparse (lightweight, streaming, well-tested) | Standard |
| CSV import flow | Two-phase: upload → preview/validate → confirm/commit | User sees what will happen before it does |
| CSV import errors | Per-row error reporting; user can choose to skip errored rows or fix and retry | Robust |
| Max rows per import | 100,000; larger datasets use the API or query console export | Bounded |
| Export trigger | "Export" button → background job → signed URL; respects current filter/sort | Async; doesn't block UI |
| Real-time collaboration | Yes; events from Objective 14's realtime layer; cells with concurrent edits show indicators | Subtle but valuable |
| Permission caching | Per-row permissions cached for 30 seconds; invalidated on schema/membership change | Performance vs. correctness |
| Foreign key resolution | Lazy fetch on first display; cached per (page-load, table) | Avoids N+1 |
| Default page size | 50 rows | Spreadsheet-feel; keyboard-navigable in a screen |
| Max page size | 500 rows | Beyond this, performance degrades; pagination is healthy anyway |

---

## 4. Architectural Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                       USER (browser)                                  │
│                                                                       │
│   Data Browser Page                                                    │
│   - Top bar: filter, sort, view selector, actions                     │
│   - Left sidebar: table picker (within current schema)                │
│   - Main: virtualized grid                                             │
│   - Bottom bar: pagination, row count, selected count                 │
│   - Side panel (when row selected): row detail / edit                 │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                ┌────────────┼────────────┐
                │            │            │
                ▼            ▼            ▼
        ┌────────────┐ ┌──────────┐ ┌──────────────┐
        │ REST API   │ │ Realtime │ │ Storage API  │
        │ (Obj 12)   │ │ (Obj 14) │ │ (Obj 15)     │
        │ - List     │ │  - Live   │ │  - Image     │
        │ - Get      │ │    events │ │    previews  │
        │ - Create   │ │           │ │              │
        │ - Update   │ │           │ │              │
        │ - Delete   │ │           │ │              │
        └────────────┘ └──────────┘ └──────────────┘
                │            │            │
                └────────────┼────────────┘
                             │
                             ▼
                ┌────────────────────────┐
                │   Backend services      │
                │   (already complete)    │
                └────────────────────────┘
```

This objective is mostly a UI on top of existing infrastructure. The backend changes are minimal:
- A new `DataBrowserService` that adds a few helper methods (CSV import processing, view persistence, foreign-key batched lookup)
- New tables for saved views and import jobs

The bulk of the work is the UI: a polished, fast, accessible, real-time spreadsheet-like grid.

---

## 5. The Hard Parts

**5.1 Optimistic updates with conflict resolution**

The user clicks a cell, types a new value, hits Tab. The UI immediately shows the new value (feels fast). The platform sends an API update with optimistic locking (the row's `_version`). Three outcomes:

- **Success**: nothing more to do; the cell stays as edited
- **Network error**: retry transparently a few times; if still failing, revert and show "Couldn't save" toast
- **Conflict (409, optimistic lock failure)**: another user edited the same row first; the platform now has a conflict to resolve

For conflict resolution, the UI:
1. Pauses the user's edit (cell shows pending indicator)
2. Fetches the current server state of the row
3. Shows a modal: "This row was changed by [User] [time ago]. Their value: X. Your value: Y. Take theirs / Take yours / Merge"
4. On user choice, updates the row with the chosen value (using the server's current `_version`)
5. Resumes UI updates

This is honest and user-driven. Auto-merge would silently lose data; auto-overwrite would let last-write-win silently kill colleagues' work.

**5.2 Real-time updates without disrupting the user's edits**

A live event arrives saying row X was updated. If the user is currently editing row X, applying the update would lose their edit. The platform handles this:

- If the user is editing row X: queue the update; show a subtle "Row updated by [other user]" indicator; on commit/cancel of the user's edit, apply the update
- If the user is NOT editing row X: apply immediately; brief flash highlight shows the change
- If the row is selected (but not editing) and the user is viewing the detail panel: show "this row updated; refresh?" with a refresh button

The result feels collaborative without being chaotic. Users see other people's changes; their own work isn't trampled.

**5.3 Foreign key resolution**

A column referencing `users.id` shows the raw UUID by default. That's useless. The browser:

- Detects FK columns from the schema
- For each visible row, batches FK lookups (one query per related table per page render)
- Caches resolved values per (FK column, ID) for the page lifetime
- Renders the related table's primary display column (configurable per FK; defaults to "name", "title", "email", whichever exists)

For editing FK values: the cell becomes a search-as-you-type combobox. The user types; the platform queries the related table with a partial match; results appear; user picks. The selected row's ID is what gets stored.

Performance: with 50 rows on screen each having 3 FK columns, that's potentially 150 lookups. Batched into 3 queries (one per FK target table) with `WHERE id IN (...)`. Fast and bounded.

**5.4 CSV import with validation**

The two-phase flow:

1. **Upload phase**: user drops a CSV file. The platform:
   - Parses the header row
   - Auto-maps columns to schema fields (case-insensitive name match; user can manually override)
   - Validates a sample (first 100 rows): checks types, NULL handling, FK existence, unique constraints
   - Shows a preview: "100,000 rows detected. Header maps to: [diagram]. 47 rows have validation errors: [click to see]"
   - User confirms the mapping or adjusts

2. **Commit phase**: user clicks "Import". The platform:
   - Runs as a background job (uses JobQueuePort)
   - Streams rows from the CSV
   - Inserts in batches of 1000 (uses the bulk-create endpoint)
   - Tracks progress
   - On error in any batch: reports the row number(s); user choice was already made (skip vs. fail-all)
   - Final report: "98,000 rows imported, 2,000 skipped. Errors saved to error.csv (downloadable)"

The import job is itself audited; the audit references the import job ID; admins can see what was imported when by whom.

**Data type handling on import**:
- Strings: trimmed, validated against length constraints
- Numbers: parsed; NaN/empty handled per column nullable
- Booleans: "true"/"false"/"yes"/"no"/"1"/"0" all accepted
- Dates: ISO 8601 preferred; common formats heuristically parsed; ambiguous failures flagged
- JSON: validated
- Arrays (where supported): comma-separated or JSON-array format
- FK: by ID OR by display value (with disambiguation if multiple matches)
- File columns: NOT supported in CSV (the path/URL gets imported as a string, but actual file uploads must come via the storage API)

**5.5 Permission-aware rendering**

Different users see different things in the same data browser:

- **Read-only user**: all cells display normally; no edit on click
- **Edit-some-not-others user**: rows they can edit have edit controls; rows they can't are visually distinct (slight tint, no edit on click)
- **Cell-level redaction (PII without `pii.read`)**: cells show as `••••••` or "redacted" in dim text
- **Field-not-yet-permitted to read**: cell empty with explicit "redacted" placeholder

The UI gets row permissions from the API response (which already does the per-row authorization). Each row's response includes a `_permissions` field: `{ canEdit: true, canDelete: false, redactedFields: ["email"] }`. The grid uses this to drive the rendering.

**5.6 Real-time integrated**

The data browser subscribes to the table's change stream. As events arrive:
- `insert`: new row appears (optionally highlighted briefly)
- `update`: existing row updates (with the user-edit-pause logic from 5.2)
- `delete`/`archive`: row disappears (or shows as archived if user toggled "show archived")

Subscription scoping: a subscription per visible page of the table, with the same filter the user is viewing. As the user filters or paginates, subscriptions are added/removed. This keeps the event volume bounded.

For workspaces with very high event rates, a "real-time off" toggle exists. The user can opt out for performance; the page becomes manually-refreshed.

**5.7 Bulk operations**

User selects 100 rows via shift-click; clicks "Delete". The browser:
1. Confirms: "Delete 100 rows? This cannot be undone (or: rows will be archived; recoverable for 90 days)."
2. On confirm: calls the bulk delete API (Objective 12's `DELETE /<table>?filter=...`)
3. Shows progress: "Deleting 100 rows... 45 done"
4. On completion: shows result; refreshes the view
5. On partial failure: shows what succeeded, what didn't, why

Bulk update: same pattern. The UI presents the editable fields; user provides new values; "Apply to N rows" confirms; the bulk update API processes.

Bulk operations are bounded by the API limits (1000 rows for bulk per Objective 12). For larger operations, the user uses the query console or the import flow.

**5.8 Saved views**

A "view" is a configuration of filters, sorts, visible columns, and column orders. Useful when a team has standard ways of looking at a table:

- "Active users" view: filter `status = 'active'`, sort `last_login desc`
- "Customers in trial" view: filter `subscription_type = 'trial'`, columns visible: name, email, trial_end_date

Saved views live in the database:

```typescript
data_browser_views: {
  ...standardColumns,
  workspace_id: uuid,
  schema_id: uuid,
  table_id: string,             // refers to TableDefinition's stable id
  created_by_user_id: uuid,
  name: string(255),
  description: text?,
  filter_config: json,           // serialized Filter AST
  sort_config: json,
  visible_columns: json,         // ordered list of column ids
  shared: boolean,
}
unique: [workspace_id, schema_id, table_id, created_by_user_id, name]
```

URL of the data browser includes the view name when one is active. Shareable links work; permissions still apply (a viewer of a "shared" view runs queries with their own permissions).

**5.9 Schema awareness drives UX**

The data browser knows from the schema what each column is:

- Required columns marked with an asterisk
- Nullable columns can be set to NULL
- Default values used when creating new rows
- Length constraints enforced in the input
- FK columns get the FK picker
- File/image/video columns get the storage picker
- PII flag drives the redaction logic

This is what makes the browser feel polished: types matter, constraints matter, the UI knows them.

**5.10 Performance with many rows / large schemas**

A workspace with 100 tables, several with millions of rows. The data browser must:

- Load the table picker fast (just metadata; doesn't load rows for tables not viewed)
- Switching tables fast (paginated query for the new table; ~1s for the first page on a million-row table)
- Scrolling within a page fast (virtualization handles this — rows render only when in viewport)
- Bulk operations bounded; "select all" on a multi-million row table doesn't try to load every row, just selects "all matching the filter" (the bulk operation uses the filter, not enumerated IDs)

These are TanStack Table + Virtual's strengths; the platform builds on them rather than replacing.

---

## 6. Component Specifications

### 6.1 DataBrowserService

```typescript
// packages/core/src/services/data-management/data-browser/data-browser.service.ts

export class DataBrowserService {
  constructor(
    private readonly authz: AuthorizationPort,
    private readonly schemas: SchemaService,
    private readonly views: RepositoryPort<DataBrowserView>,
    private readonly importJobs: RepositoryPort<ImportJob>,
    private readonly fileStorage: StorageService,
    private readonly jobQueue: JobQueuePort,
    private readonly audit: AuditPort,
    private readonly logger: LoggerPort,
  ) {}

  // Saved views
  async listViews(ctx: RequestContext, opts: ListViewsOptions): Promise<Result<PaginatedResult<DataBrowserView>, AppError>>;
  async getView(ctx: RequestContext, viewId: string): Promise<Result<DataBrowserView, AppError>>;
  async createView(ctx: RequestContext, input: CreateViewInput): Promise<Result<DataBrowserView, AppError>>;
  async updateView(ctx: RequestContext, viewId: string, changes: ViewUpdate): Promise<Result<DataBrowserView, AppError>>;
  async deleteView(ctx: RequestContext, viewId: string): Promise<Result<void, AppError>>;

  // CSV/JSON import
  async startImport(ctx: RequestContext, input: StartImportInput): Promise<Result<ImportJob, AppError>>;
  async getImportJob(ctx: RequestContext, jobId: string): Promise<Result<ImportJob, AppError>>;
  async cancelImport(ctx: RequestContext, jobId: string): Promise<Result<void, AppError>>;

  // CSV/JSON export
  async startExport(ctx: RequestContext, input: StartExportInput): Promise<Result<ExportJob, AppError>>;

  // Foreign key batched lookup helper
  async resolveForeignKeys(
    ctx: RequestContext,
    schemaId: string,
    requests: FkLookupRequest[],
  ): Promise<Result<FkLookupResult[], AppError>>;
}
```

Most data operations use the existing REST APIs from Objective 12. This service adds the helpers specific to the browser: views, imports, exports, batched FK lookups.

### 6.2 Database Schema for Views and Import Jobs

```typescript
// data_browser_views as defined in Section 5.8

import_jobs: {
  ...standardColumns,
  workspace_id: uuid,
  schema_id: uuid,
  table_id: string,
  initiated_by_user_id: uuid,
  source_file_id: uuid,             // refers to a file in storage; the uploaded CSV
  column_mapping: json,
  status: enum('pending', 'validating', 'importing', 'completed', 'failed', 'cancelled'),
  total_rows: int?,
  imported_rows: int,
  skipped_rows: int,
  error_file_id: uuid?,             // file with error rows for download
  error_summary: json,
  started_at: timestamp?,
  completed_at: timestamp?,
}
indexes: [workspace_id, initiated_by_user_id], [status, _created_at]
```

### 6.3 The Data Browser UI Components

Lives in `apps/web/src/data-management/data-browser/`:

- `DataBrowser.tsx` — main page; layout shell
- `panels/TablePicker.tsx` — left sidebar; lists tables in current schema
- `panels/Toolbar.tsx` — top bar: filter, sort, columns, view selector, refresh, export, import
- `panels/Grid.tsx` — the virtualized data grid (TanStack Table + Virtual)
- `panels/RowDetailPanel.tsx` — side panel for viewing/editing a single row in detail
- `panels/StatusBar.tsx` — bottom bar: pagination, row count, selected count, real-time indicator
- `cells/<Type>Cell.tsx` — one component per column type:
  - `StringCell.tsx`, `NumberCell.tsx`, `BooleanCell.tsx`, `DateCell.tsx`, `DecimalCell.tsx`
  - `JsonCell.tsx`, `ArrayCell.tsx`
  - `FkCell.tsx` — handles foreign key display + picker
  - `FileCell.tsx`, `ImageCell.tsx`, `VideoCell.tsx` — handles storage references
- `dialogs/FilterDialog.tsx` — visual filter builder using the Filter AST
- `dialogs/ImportDialog.tsx` — two-phase import with preview
- `dialogs/ExportDialog.tsx` — format selection, scope (filtered vs. all)
- `dialogs/ConflictResolutionDialog.tsx` — for optimistic-lock conflicts
- `dialogs/SaveViewDialog.tsx`
- `dialogs/BulkActionDialog.tsx`
- `dialogs/RowDeleteConfirmDialog.tsx`
- `dialogs/SchemaQuickReferenceDialog.tsx` — show the table's structure inline (for users who don't want to leave the browser to check the schema designer)

Each dialog and panel is permission-aware; controls hidden or disabled based on the user's permissions.

### 6.4 Cell Component Pattern

Every cell type has the same interface:

```typescript
export interface CellProps<TValue> {
  value: TValue;
  isEditing: boolean;
  canEdit: boolean;
  isRedacted: boolean;
  onStartEdit: () => void;
  onChange: (value: TValue) => void;
  onCommit: () => Promise<void>;
  onCancel: () => void;
  columnDef: ColumnDefinition;
  rowContext: RowContext;
}
```

This consistency means new cell types (introduced as new column types are added to the schema model) plug in the same way. The grid orchestrates; cells render and edit.

### 6.5 Import Job Worker

Runs as a background job processed by JobQueuePort. The worker:

1. Reads the import job from the database
2. Streams the source CSV file from storage
3. Per-row: applies column mapping, validates against schema, transforms types
4. Buffers rows in batches of 1000
5. Calls the platform's bulk-create API (which audits per-batch, not per-row)
6. On batch error: per the user's chosen mode (skip-errors or fail-all)
7. Updates the import_job record with progress (every 5 seconds or every 5000 rows)
8. On completion: writes any errors to a CSV in storage; updates the job to "completed"
9. Emits notification (in-app banner; email if configured)

The user can monitor progress via the browser; the job continues even if the user closes the browser.

### 6.6 Export Job Worker

Similar pattern but reverse:

1. Reads the export job parameters (table, filter, sort, format, scope)
2. Pages through the table data using the same API the browser uses
3. Writes rows to a CSV/JSON file streaming to storage
4. Includes only the columns the user has permission to read; redacts PII per usual
5. On completion: produces a signed URL for download (TTL 7 days)
6. Notifies the user

Bounded by file size (1 GB default; configurable). Larger exports must be split.

### 6.7 Realtime Subscription Integration

The data browser opens a subscription per visible table page:

```typescript
// pseudo-code in the React component

useEffect(() => {
  const subscription = realtimeClient.subscribe({
    schemaId,
    tableId,
    filter: currentFilter,
    operations: ['insert', 'update', 'delete'],
  });

  subscription.on('event', (event) => {
    handleRealtimeEvent(event);
  });

  return () => subscription.close();
}, [schemaId, tableId, currentFilter]);
```

The handler:
- For `insert`: if the new row matches the current filter, prepend or insert at appropriate position
- For `update`: if the row is in the current page, update it (with the editing-pause logic)
- For `delete`: if the row is in the current page, remove it
- For events not matching current filter/page: increment a "events outside view" counter shown in the status bar

### 6.8 Permission-Aware UI Hooks

A React hook that exposes permission info from the API responses:

```typescript
function useRowPermissions(row: any) {
  return {
    canEdit: row._permissions?.canEdit ?? false,
    canDelete: row._permissions?.canDelete ?? false,
    redactedFields: new Set(row._permissions?.redactedFields ?? []),
  };
}
```

Cells use this hook to determine their rendering. The grid uses it to determine row-level edit availability.

### 6.9 Audit Events

Audit events from the data browser flow through the existing audit infrastructure. Events specifically introduced or surfaced by this objective:

```
data_management.browser.view_created
data_management.browser.view_updated
data_management.browser.view_deleted
data_management.browser.view_shared
data_management.browser.import_started (with file_id)
data_management.browser.import_completed (with imported/skipped counts)
data_management.browser.import_failed
data_management.browser.import_cancelled
data_management.browser.export_started
data_management.browser.export_completed
data_management.browser.bulk_action_initiated (with action type, row count, filter)
```

Cell-level edits already audit via Objective 12's `data_management.api.row_updated` events. The browser doesn't add new audit events for individual edits; it triggers the API which audits.

### 6.10 Operational Runbooks

New files in `docs/runbooks/`:

- `data-browser-stuck-import.md` — diagnosing an import job that's hung
- `data-browser-realtime-disconnected.md` — when the browser shows stale data; reconnection steps
- `data-browser-large-export-failed.md` — handling exports that exceed size limits
- `data-browser-conflict-resolution-spike.md` — when many users see conflicts; usually means a stale-cache issue
- `data-browser-fk-resolution-slow.md` — diagnosing slow foreign-key resolution; index recommendations

---

## 7. Implementation Order

1. **Database schema** for `data_browser_views` and `import_jobs` migrated.

2. **DataBrowserService skeleton** — view CRUD, FK lookup helper.

3. **Basic table viewer UI** — TanStack Table + Virtual; loads rows from the existing API; pagination.

4. **Cell components for primitive types** — string, number, boolean, date.

5. **Inline editing for primitive types** — click to edit, Tab/Enter to save, Esc to cancel.

6. **Optimistic updates with conflict resolution dialog.**

7. **Filter UI** — visual builder generating Filter AST.

8. **Sort UI** — column header click + multi-column.

9. **Cell components for complex types** — JSON, decimal, arrays.

10. **Foreign key cell with batched lookup and combobox picker.**

11. **File / image / video cell components** integrated with Objective 15's storage.

12. **Permission-aware rendering** using row `_permissions` field.

13. **PII redaction in display.**

14. **Real-time subscription integration with editing-pause logic.**

15. **Bulk selection** (shift-click, ctrl-click, drag).

16. **Bulk actions** (delete, archive, restore, hard-delete) using bulk APIs.

17. **CSV/JSON import flow** — upload, preview, validate, commit.

18. **Import job background worker.**

19. **CSV/JSON export flow** — async to storage; signed URL.

20. **Saved views CRUD UI.**

21. **Bookmarkable URLs reflecting current filter/sort/view.**

22. **Row detail panel for full-row editing.**

23. **Schema quick-reference dialog.**

24. **Keyboard navigation** — full keyboard control.

25. **Accessibility audit** — WCAG 2.2 AA compliance.

26. **Performance optimization** — verify million-row table feels responsive.

27. **Cross-database conformance** — equivalent UX on Postgres/MSSQL/Mongo schemas.

28. **Documentation, runbooks, ADRs.**

29. **Verify Definition of Done.**

---

## 8. ADRs to Write

- **ADR-0138: TanStack Table for the Grid** — alternatives (AG-Grid, Glide Data Grid, Material Table); rationale
- **ADR-0139: Optimistic Updates with Conflict Resolution** — feels fast; honest about conflicts
- **ADR-0140: Two-Phase CSV Import** — preview before commit; user understands what will happen
- **ADR-0141: Real-Time Subscription Per View** — bounded event volume; subscription churn on filter change
- **ADR-0142: FK Batched Lookup** — performance vs. simplicity; lazy load with caching
- **ADR-0143: Saved Views as First-Class Objects** — sharing and discoverability; URLs that capture state

---

## 9. Verification Steps

1. **Table viewer loads** the customer table; rows display; pagination works; column types render appropriately.

2. **Inline cell edit** — string, number, boolean, date, decimal cells all editable; saves on Tab/blur; reverts on Esc.

3. **Optimistic update** — edit feels instant; success or rollback reflected.

4. **Conflict resolution** — two users edit the same cell; second sees the conflict dialog; chooses resolution; data saved correctly.

5. **Filter** — visual filter builder produces the same results as the equivalent API call; complex filters (AND/OR) work.

6. **Sort** — single and multi-column sort works; persists across pagination.

7. **JSON cell** — view JSON readably; edit JSON; validation errors clear; save works.

8. **Foreign key cell** — displays the related row's name (not raw UUID); editing opens combobox; search-as-you-type returns results; selection persists ID.

9. **File / image cell** — image preview renders; click opens full preview; upload flow works through the storage layer.

10. **Permission-aware display** — a user without edit permission sees read-only cells; a user without `pii.read` for `email` sees redacted email cells.

11. **Real-time updates** — open table in two tabs; insert via API in tab 1; tab 2 shows the new row within 2 seconds; update similarly; delete similarly.

12. **Editing pause during real-time** — user editing row X while real-time event for row X arrives: edit is preserved; pending update queued; resolved on commit.

13. **Bulk select** — shift-click, ctrl-click, drag-select all work; selection count shows in status bar.

14. **Bulk delete** — selected rows deleted via API; UI updated; audit events emitted.

15. **CSV import — happy path** — upload a 1000-row CSV; preview shows mapping; commit; rows imported; verified in table.

16. **CSV import — validation errors** — upload CSV with 50 errored rows; preview shows them; user chooses skip; import completes with 950 imported, 50 skipped.

17. **CSV import — large file** — 100,000-row import completes in background; progress visible; user can leave the page and return.

18. **CSV export — filtered scope** — apply filter; export; downloaded CSV contains only filtered rows; columns and types correct.

19. **CSV export — large** — export 50,000-row table; background job; completion notification; download via signed URL.

20. **Saved view** — create a view with filter and sort; share; another member opens; sees the same view; bookmarkable URL works.

21. **Keyboard navigation** — tab through cells; Enter to edit; arrow keys; full grid usable without mouse.

22. **Accessibility** — axe-core passes; screen-reader walkthrough completes; ARIA roles correct.

23. **Performance — million rows** — table with 1M rows scrolls smoothly; first page loads < 1s; switching pages < 500ms.

24. **Cross-database** — same data browser experience on a Postgres-backed, MSSQL-backed, and Mongo-backed workspace.

25. **Mobile fallback** — mobile viewport shows a usable read-only view (full editing is desktop-first; mobile is best-effort).

26. **Schema quick-reference** — shows table structure inline; column types, constraints, FKs visible; doesn't require leaving the browser.

If all 26 pass, the objective is met.

---

## 10. Definition of Done

**Service Layer**
- [ ] DataBrowserService implemented
- [ ] Database tables (views, import_jobs) migrated on all three databases
- [ ] FK batched lookup helper

**Background Workers**
- [ ] Import job worker
- [ ] Export job worker
- [ ] Both audit-integrated

**UI Components**
- [ ] DataBrowser main page
- [ ] All panels (TablePicker, Toolbar, Grid, RowDetailPanel, StatusBar)
- [ ] All cell components for every supported column type
- [ ] All dialogs (filter, import, export, conflict, save view, bulk action, schema quick reference, delete confirm)

**Editing**
- [ ] Inline edit for primitive types
- [ ] FK picker
- [ ] Storage upload integration for file/image/video columns
- [ ] Optimistic updates
- [ ] Conflict resolution UI

**Filtering / Sorting / Pagination**
- [ ] Visual filter builder
- [ ] Multi-column sort
- [ ] Default page size 50; configurable up to 500
- [ ] URL persistence

**Real-Time**
- [ ] Subscription per view
- [ ] Editing-pause logic
- [ ] Subscription churn on filter change

**Bulk Operations**
- [ ] Selection (click, shift, ctrl, drag)
- [ ] Bulk delete, archive, restore
- [ ] Bulk update (basic)

**Import / Export**
- [ ] CSV import with preview, validation, commit
- [ ] JSON import (similar)
- [ ] CSV export with filtered/all scope
- [ ] JSON export
- [ ] Large-import / large-export bounded with clear limits

**Saved Views**
- [ ] CRUD
- [ ] Sharing
- [ ] URL persistence

**Permissions**
- [ ] Row-level permission display
- [ ] PII redaction
- [ ] Edit/delete buttons disabled without permission

**Accessibility**
- [ ] WCAG 2.2 AA on all screens
- [ ] Keyboard navigation
- [ ] axe-core in CI

**Performance**
- [ ] 1M-row table renders smoothly
- [ ] First page < 1s; subsequent pages < 500ms
- [ ] FK resolution batched (no N+1)

**Cross-Database Conformance**
- [ ] Equivalent UX on Postgres, MSSQL, Mongo
- [ ] Capability gaps surfaced (no array column input on MSSQL, etc.)

**Audit & Observability**
- [ ] Audit events emitted for browser-specific actions
- [ ] Metrics for grid load times, import durations, real-time event rates

**Documentation**
- [ ] ADRs 0138–0143 written and Accepted
- [ ] All runbooks in Section 6.10 written
- [ ] Customer-facing data browser guide

**Verification**
- [ ] All 26 verification steps in Section 9 pass

---

## 11. Anti-Patterns to Refuse

- **Overwriting other users' edits silently on conflict.** Conflict dialog is non-negotiable; user-driven resolution.
- **Auto-merging conflicting cell values.** "Merge" can lose data invisibly; manual is the right default.
- **Loading all rows then filtering client-side.** Server-side filter through the API; client doesn't see what the user can't.
- **Unbatched FK lookups.** N+1 disaster on every page render. Batched, cached, or lazy-loaded.
- **Sending all column data to the browser regardless of permission.** Redacted fields are redacted at the API; the browser respects what the API returns.
- **Skipping the editing-pause logic on real-time events.** Trampling user edits is unforgivable.
- **Rendering 100,000 rows in the DOM.** Virtualization mandatory.
- **Letting saved views run with the saver's permissions instead of the runner's.** Permission elevation via shared view is a security bug.
- **Letting CSV imports bypass the platform's bulk-create API.** Direct database writes from the import worker would skip authorization, audit, validation. Use the API.
- **Showing detailed error messages from the database.** "Constraint violation: duplicate key value violates unique constraint" leaks structure. Friendly messages: "A row with this email already exists." Detailed errors in audit / logs.
- **Confirming dangerous actions with a single-button dialog.** Destructive actions need explicit "type the table name" or two-step confirms.
- **Real-time subscriptions per cell or per row.** One subscription per visible table-view; events filtered on the platform side.

---

## 12. Open Questions for Confirmation Before Starting

1. **Default page size 50** — Notion/Airtable use 100; Excel-style apps go higher. Recommendation: 50 for default keyboard-navigation feel; configurable up to 500 per workspace.

2. **Foreign key display column** — proposing the platform picks the "name" / "title" / "email" column heuristically; user can override per FK in the schema. Acceptable?

3. **CSV import row limit 100,000** — appropriate? Recommendation: yes; larger uses query console export → process externally → API.

4. **Real-time on by default** — the browser subscribes automatically. Some workspaces with high write rates may prefer it off by default. Recommendation: on by default; per-workspace toggle; per-user preference override.

5. **Mobile experience scope** — confirmed desktop-first; mobile read-only best-effort? Or invest more?

6. **Permission caching duration (30s)** — appropriate? Recommendation: yes for normal cases; admin actions invalidate immediately via the internal event bus from Objective 14.

7. **Saved view sharing model** — proposing workspace-wide visibility; viewers run with their own permissions. Acceptable?

8. **Conflict resolution dialog UX** — proposing modal with three options (theirs/yours/merge). Some platforms auto-merge if non-overlapping fields. Recommendation: keep it explicit; auto-merge invites surprises.

---

## 13. What Comes Next

With Objective 18 complete, the Data Management Module has a polished, real-time, permission-aware spreadsheet UI for customer data. Combined with the schema designer, APIs, realtime layer, storage, auth UI, and query console — every customer-facing surface is in place. The platform is genuinely a Supabase competitor.

**Objective 19: Public SDK** is the final piece. The "Supabase client equivalent" that wraps everything (REST, GraphQL, Realtime, Storage, Auth, Query) into a TypeScript / Python / etc. SDK. Customer developers use the SDK to build their own applications on top of the platform.

After Objective 19:
- The Data Management Module is **complete**: a self-hostable Supabase equivalent on Postgres, MSSQL, or MongoDB
- The platform has a **sellable product** that can be demo'd, evaluated, and deployed by customers
- Stage 1 of the AI build pipeline can begin in parallel — both streams ship on the same foundation

---

*This document is the contract. Every checkbox in Section 10 must be true before moving on to Objective 19.*
