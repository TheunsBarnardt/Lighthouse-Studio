# Data Migration Guide (Stage 5)

Data Migration is Stage 5 of the AI Build Pipeline. It maps existing data from legacy systems to your new schema and executes a validated migration. This stage is **optional** — greenfield projects skip it.

---

## When to use this stage

Use Stage 5 if you have existing data to preserve:

- Rebuilding a legacy system with new schema
- Migrating from a competing platform
- Importing from CSV/Excel exports
- Consolidating data from multiple sources

Skip Stage 5 entirely for brand-new projects with no existing data.

---

## Supported Sources

| Source | Connection type |
|--------|----------------|
| **PostgreSQL** | Connection string (read-only) |
| **SQL Server (MSSQL)** | Connection string (read-only) |
| **MySQL** | Connection string (read-only) |
| **MongoDB** | Connection string (read-only) |
| **CSV** | File upload |
| **JSON** | File upload (array of objects or JSON Lines) |
| **Excel (.xlsx)** | File upload; each sheet becomes a source table |

The platform connects with **read-only** credentials only. It never writes to the source.

---

## The Migration Flow

### Step 1: Connect Source

Choose your source type and provide connection details or upload a file. Use a dedicated read-only service account for database connections — not a personal or admin account.

### Step 2: Introspection

The platform reads your source schema: tables, columns, types, row counts, and a sample of rows. For databases, it also reads primary keys and foreign keys.

Review the introspection results. For file sources, check that column names and types are detected correctly. Specify file encoding if the default (UTF-8) is wrong.

### Step 3: Generate Mapping

Click **Generate Mapping**. The AI maps source columns to target columns based on:
- Column name similarity
- Type compatibility
- Sample data patterns
- Your PRD context
- Any notes you provide

The mapping editor shows a visual canvas: source columns on the left, target columns on the right, connection lines between them. Transformation badges appear on lines where conversions are needed.

#### Editing the mapping

Click a connection line to open the transformation builder. You can:
- Add or remove transformation steps
- Write custom JavaScript expressions (sandboxed)
- Mark a target column as intentionally unmapped
- Split one source column into multiple target columns

Unmapped **required** target columns appear as warnings — they'll block migration unless mapped or given a literal default.

### Step 4: Preview

The preview runs the first 100 rows (configurable up to 1,000) through your mapping without writing to the target. Review the source → target results. If transformations produce errors, fix the mapping and re-preview.

### Step 5: Approval

Submit the mapping plan for approval. In team workspaces, configured approvers (typically architects) receive a notification. Solo workspaces approve immediately.

Before approval, acknowledge any **irreversible operations** — column splits where original data can't be reconstructed from the transformed result.

### Step 6: Execution

The migration runs as a background job with real-time progress:

- A pre-migration snapshot is taken first (see Rollback)
- Data is migrated in batches of 1,000 rows (configurable)
- Progress shows rows completed, ETA, and error count
- You can cancel mid-execution; partial data remains and rollback is available

### Step 7: Validation

After execution, five checks run automatically:

| Check | What it verifies |
|-------|-----------------|
| Row count match | Target has the expected number of rows |
| FK integrity | All FK columns reference existing parent rows |
| No truncation | No string columns at exactly their max length |
| Required columns | No NULLs in NOT NULL columns |
| Sample comparison | 100 random rows verified against source |

Failed validations are surfaced with details. You choose whether to roll back or accept and fix manually.

---

## Rollback

A snapshot of all affected target tables is taken before execution starts. Within **24 hours** of completion, you can roll back: all affected tables are restored to their pre-migration state.

After 24 hours, the snapshot expires. Recovery requires your database's point-in-time recovery feature (recommended for production) or a manual re-migration. See the [rollback-after-window runbook](../runbooks/data-migration-rollback-after-window.md).

---

## Transformation Library

The platform includes a curated set of built-in transformations:

**String**: `trim`, `lowercase`, `uppercase`, `capitalize`, `slugify`, `regex_replace`, `regex_extract`, `split`, `join`, `substring`, `pad`, `mask`

**Number**: `parse_int`, `parse_float`, `round`, `multiply`, `divide`, `add`, `subtract`

**Date**: `parse_date`, `format_date`, `add_days`, `to_unix_timestamp`

**Boolean**: `parse_bool` — handles yes/no, true/false, 1/0

**JSON**: `parse_json`, `format_json`, `extract_path`

**Lookup**: `lookup_in_table`, `resolve_by_natural_key` — for FK resolution by natural key

**Conditional**: `if_null`, `if_empty`, `default_if`

Chain transformations: `trim → lowercase → parse_email`. Each step receives the previous step's output.

### Custom JS expressions

For cases the library doesn't cover:

```javascript
// Input: value (current column value), row (full source row)
return value.replace(/\s+/g, ' ').trim();
```

Expressions run in a sandbox with no I/O access and a 100ms time limit per row. `eval`, `fetch`, and `require` are blocked.

---

## Error Tolerance Modes

Choose how to handle row-level errors during migration:

| Mode | Behavior |
|------|---------|
| **Fail on first error** | Stops at first failed row |
| **Fail on batch error** (default) | Stops if > 5% of a batch fails |
| **Continue with error log** | Continues; errors logged to downloadable report |

The default is fail-on-batch-error with a 5% threshold — it protects against systematic problems while tolerating occasional bad rows.

---

## FK Resolution

When source tables use natural keys (email, customer code, etc.) but the target uses UUIDs:

1. The AI proposes a `resolve_by_natural_key` transformation
2. During migration, the platform looks up the target UUID for each natural key value
3. The UUID is written to the target FK column

For many-to-many relationships going from junction tables to embedded documents (Mongo targets), the AI proposes an embedding strategy in the mapping.

---

## Cost

Migration plan generation typically costs **$0.50–$5.00** depending on source complexity. Execution cost is compute time only (no AI calls). Cost is tracked per workspace in the usage dashboard.

---

## What Comes Next

With your data migrated, you're ready for:

- **Stage 6: UI Generation** — generate React components from your schema and design tokens
- **Stage 5 isn't required for UI generation** — you can generate UI before migrating data
