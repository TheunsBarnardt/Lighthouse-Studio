# Runbook: Data Browser — Schema Drift Warning

**Symptom:** A user sees a yellow warning banner in the data browser:

> "This view references columns that no longer exist. Some filters or columns may not be applied."

Or:

> "This view was saved with an older schema. [Edit view] [Dismiss]"

This warning appears when a saved view references columns that have been renamed or removed from the underlying table since the view was saved.

---

## 1. Understand the Warning

Saved views capture a `schema_hash` of the table's column list at the time the view is saved (ADR-0143). When the view is loaded, the platform compares the current schema against the stored hash. If columns referenced in the view's filter AST or column visibility list no longer exist, the drift warning is shown.

The view is still partially applied: valid columns are honoured; missing columns are skipped. A filter on a missing column is dropped, which may cause the view to return more rows than intended — this is the main risk.

---

## 2. Identify the Affected Columns

In the warning banner, click **Edit view**. The view editor will highlight columns that no longer exist in red. Alternatively, query the view config directly:

```sql
SELECT id, name, config, schema_hash, updated_at
FROM data_browser_views
WHERE id = '<view_id>';
```

Extract the column names from `config->>'columns'` and `config->>'filterAst'` and compare against the current table schema:

```sql
-- Get current columns for the table
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'cust_<slug>'
  AND table_name = '<table>';
```

---

## 3. Resolve the Drift

**Option A: Update the view** (recommended when the change was a rename)

Have the view owner open the view editor, update the filter and column configuration to reference the new column names, and save. This updates `schema_hash` to the current schema.

**Option B: Delete the stale view** (appropriate when the column is genuinely gone)

```sql
DELETE FROM data_browser_views
WHERE id = '<view_id>';
```

Notify the view owner (email or Slack) that the view was deleted due to a schema change and provide instructions to recreate it.

**Option C: Update the view config programmatically** (for bulk migrations)

If a column was renamed across many views, use a migration script:

```sql
UPDATE data_browser_views
SET config = jsonb_set(
  config,
  '{filterAst}',
  replace(config->>'filterAst', '"old_column_name"', '"new_column_name"')::jsonb
),
schema_hash = '<new_hash>',
updated_at = NOW()
WHERE config::text LIKE '%old_column_name%'
  AND workspace_id = '<workspace_id>';
```

Always verify the config is valid JSON after an in-place update and test the affected views.

---

## 4. Prevent Future Drift

The drift warning is a symptom of schema changes being made without updating dependent views. The following practices reduce drift incidents:

**Before renaming or removing a column:**

```bash
# Check if any saved views reference the column
platform schema validate --check-view-dependencies --schema <slug> --column <column_name>
```

This command reports all saved views that reference the column. Coordinate with view owners before making the change.

**Run schema validation in CI:**

Add `platform schema validate` to your schema migration pipeline. The command will warn (not fail by default; set `--fail-on-warnings` to make it fail) if schema changes would invalidate existing saved views.

**Prefer additive changes:**

Instead of renaming `user_id` to `author_id`, add an `author_id` column (possibly as an alias or computed column), migrate data, and remove `user_id` in a subsequent release. This gives view owners time to update their configurations.

---

## 5. After Resolution

Once the affected views are updated or deleted, confirm the warning no longer appears:

1. Navigate to the data browser for the affected table.
2. Load each previously-affected view via its URL (`?view=<id>`).
3. Verify no warning banner is shown.
4. Verify the filter and sort configuration is applied correctly.

Update the incident record with the resolution. If the drift was caused by a schema migration that did not check view dependencies, open a ticket to add the validation step to the migration checklist.
