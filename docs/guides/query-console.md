# Query Console Guide

The Query Console gives you direct read (and optionally write) access to your workspace database. Use it for ad-hoc data exploration, debugging, data validation, and light data repair — without leaving the platform.

## Getting Access

By default, all workspace members with the `developer`, `architect`, `qa`, `reviewer`, or `viewer` roles can read data via the console (`query.read`).

Write access (`query.write`) is **not granted by default** to any role. A workspace owner must explicitly grant it. This is intentional — accidental mass-deletes are catastrophic.

Schema changes (CREATE TABLE, ALTER TABLE, etc.) are not permitted in the console. Use the Schema Designer instead.

## The Interface

The console has three panes:

- **Left sidebar:** Switch between Schema (table/column browser), History (recent queries), and Saved (your saved queries)
- **Centre:** Monaco editor — the query editor with syntax highlighting
- **Bottom panel:** Switch between Results, Parameters, and Explain

## Writing Queries

### SQL (PostgreSQL / MSSQL)

Write standard SQL. The editor supports:

- Syntax highlighting for PostgreSQL (`pgsql`) or T-SQL (`sql`)
- Schema-aware autocomplete: type a table name followed by `.` to see column suggestions
- Run with **Cmd+Enter** (Mac) or **Ctrl+Enter** (Windows/Linux)

### MongoDB

Write a pipeline array in JSON format:

```json
[{ "$match": { "status": "active" } }, { "$group": { "_id": "$role", "count": { "$sum": 1 } } }]
```

For `find` queries, write the filter object directly:

```json
{ "status": "active", "createdAt": { "$gte": "2026-01-01" } }
```

### Named Parameters

Use `:name` placeholders (SQL) or `$name` (MongoDB) for safe value substitution:

```sql
SELECT * FROM orders WHERE customer_id = :customerId AND status = :status
```

The Parameters panel (bottom) shows inputs for each named parameter. Values are bound as prepared statement parameters — string interpolation is never used.

## Row Limits and Timeouts

Default limits to protect database performance:

| Setting   | Default    | Maximum                                   |
| --------- | ---------- | ----------------------------------------- |
| Row limit | 1,000      | 100,000 (requires `query.large_result`)   |
| Timeout   | 30 seconds | 5 minutes (requires `query.long_running`) |

You can override these in the API call if you have the appropriate permissions.

## Write Queries

All write queries (INSERT, UPDATE, DELETE) require:

1. The `query.write` permission on your account
2. Explicit confirmation in the UI — you'll see the affected tables and statement count before execution

Multi-statement writes are automatically wrapped in a single transaction — a failure in any statement rolls back all changes.

## EXPLAIN

Click **Explain** to see the query execution plan without running the query. For PostgreSQL, you'll see the full JSON plan tree with node types, costs, and row estimates.

## Saving Queries

Click **Save** to store a query with a name, description, and optional folder path. Saved queries can be:

- Private to you (default)
- Shared with workspace members (view only)
- Shared and runnable (members can execute with their own permissions)

## Query History

Every query you run is recorded in the History panel (last 90 days). Click any entry to load it back into the editor.

## Exporting Results

Export functionality requires the job queue adapter (available in a future objective). For now, use your browser's copy-to-clipboard functionality or connect a BI tool directly via the API.

## Security Notes

- Your queries run under a database role scoped to your workspace — you cannot access other workspaces' data
- DDL statements are always blocked — use the Schema Designer
- Write query parameters are never string-interpolated — they use prepared statements throughout
- All queries (including failed ones) are recorded in the audit log
