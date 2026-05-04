# Schema Designer — User Guide

The Schema Designer is the visual interface for defining the data model that powers your workspace's auto-generated APIs, real-time subscriptions, and data browser. Everything in the Data Management Module starts here.

---

## Getting started

Open the Schema Designer from the workspace sidebar: **Data → Schemas**.

A new workspace shows starter templates. Choose one or click **Start blank** to begin with an empty `items` table. Templates are fully editable after creation.

| Template     | Tables                                           |
| ------------ | ------------------------------------------------ |
| Blank        | `items`                                          |
| Blog         | `posts`, `authors`, `categories`, `comments`     |
| CRM          | `contacts`, `companies`, `deals`, `activities`   |
| Task Tracker | `projects`, `tasks`, `users`, `comments`         |
| E-commerce   | `products`, `customers`, `orders`, `order_items` |

---

## Three views of the same schema

The designer presents three synchronized views. All three edit the same underlying model; switching between them is instant.

**Diagram view** — a visual graph. Drag tables to rearrange; drag from a column to another table to create a foreign key; see relationships at a glance. Built on @xyflow/react.

**Table view** — a list of tables with expandable column detail. Faster for sequential editing; better for keyboard-driven workflows.

**Code view** — the schema as YAML or JSON. For power users, bulk imports, and version-control diffs. Paste a valid schema document to import it.

---

## Making changes: the four-phase flow

Every change — adding a column, renaming a table, dropping an index — goes through four phases before it touches the database.

### 1. Edit

Make changes in any view. Changes accumulate in a local edit buffer; nothing is saved yet. Real-time validation flags issues as you type (red for errors, yellow for warnings, blue for info). The UI marks unsaved state visually.

### 2. Validate

Click **Save** (or let auto-save trigger, configurable per workspace). The platform runs the full validator:

- Naming: `snake_case`, no reserved words, no length violations
- Types: valid for the active database; suggests alternatives when not
- Foreign keys: referenced table and columns exist; column types match
- Indexes: indexed columns exist; make sense for the column types
- PII tagging: columns with names like `email` / `phone` prompt for PII confirmation
- Primary key: every table must have one; must be non-null

Errors block save. Warnings allow save with acknowledgement.

### 3. Preview

For changes that affect an already-deployed schema, the platform generates a migration plan showing exactly what DDL statements will run, estimated duration, and any data-loss risks. Destructive operations are highlighted in red.

### 4. Apply

Confirm and the migration runs. The platform monitors progress and reports success or automatic rollback. If rollback fails, the UI shows a clear "operator action required" banner — see the [stuck migration runbook](../runbooks/schema-stuck-migration.md).

---

## Database capability differences

The designer adapts honestly to the active database. Features unavailable on your driver are disabled with an explanation, not silently hidden.

| Feature                    | Postgres | MSSQL                 | MongoDB     |
| -------------------------- | -------- | --------------------- | ----------- |
| Array columns              | ✅       | ❌                    | ✅          |
| Partial indexes            | ✅       | ✅ (filtered indexes) | ✅          |
| Generated/computed columns | ✅       | ✅                    | ❌          |
| Row-level security         | ✅       | ✅                    | ❌          |
| Foreign key enforcement    | ✅       | ✅                    | ⚠️ advisory |
| JSON columns               | ✅       | ✅                    | ✅          |
| Change streams             | ✅       | ❌                    | ✅          |

**Foreign keys on MongoDB** are stored in schema metadata and displayed in the diagram, but the database does not enforce them. The platform validates references at write time via the auto-generated API. A warning banner appears on any FK you create for a Mongo schema.

---

## Schema versioning and rollback

Every successful apply creates an immutable version record. The history is queryable from the **History** panel.

To roll back: open the History panel, select the target version, and click **Roll back to this version**. The platform generates a reverse migration plan — the same four-phase flow applies.

> **Data loss warning.** Rolling back a column drop cannot recover the data that was in that column. The rollback restores the schema shape; data recovery requires a database backup. The UI shows a prominent warning when a rollback would lose data.

---

## PII tagging and compliance

When you add a column whose name matches a PII heuristic (`email`, `phone`, `name`, `address`, `ssn`, etc.), the designer prompts: "Does this column contain personal data?"

- **Yes** — choose a category (contact, identification, financial, health, etc.). The column is tagged; the platform records it in the compliance audit log when deployed. This feeds GDPR Article 15 (access) and Article 17 (erasure) workflows.
- **No** — enter a brief justification. The override is stored in the schema metadata.

You can change PII tagging at any time by editing the column. Changes take effect on the next deploy.

---

## Collaboration and conflict detection

Multiple users can edit the same schema. The platform uses **optimistic locking**: the first save wins; the second user sees a conflict diff and must merge manually or choose one version.

If auto-save is enabled and a conflict occurs, your edits are queued locally until you resolve it.

---

## Export and import

Use **Export** (toolbar → Export) to download the schema as:

- **JSON** — for programmatic use; the same format used internally
- **YAML** — for human-readable version control
- **Markdown** — auto-generated documentation with column descriptions, types, and PII tags

Use **Import** to paste or upload any of these formats. Imported schemas go through the full validation flow before being saved.

---

## Schema templates (custom)

After building a schema you want to reuse, use **Save as template** from the schema menu. Custom templates are available to all users in your workspace and can be exported for use in other workspaces.

---

## Namespace isolation

Customer tables are physically separated from platform tables at the database level:

- **Postgres / MSSQL**: customer tables live in schema `cust_<workspace_slug>`; the platform's own tables are in a separate schema. A scoped database role (`cust_<slug>_app`) limits runtime access to that workspace's tables only.
- **MongoDB**: customer collections use the prefix `cust_<workspace_slug>__`; platform collections use `platform_*`.

This means a SQL injection in custom API code cannot reach platform tables, and workspace A's data is physically unreachable from workspace B.

---

## Relevant runbooks

| Runbook                                                                            | When to use                                        |
| ---------------------------------------------------------------------------------- | -------------------------------------------------- |
| [Stuck migration](../runbooks/schema-stuck-migration.md)                           | Migration is running but not completing            |
| [Rollback with data loss risk](../runbooks/schema-rollback-data-loss.md)           | Rollback would lose data                           |
| [Cross-workspace isolation check](../runbooks/schema-cross-workspace-isolation.md) | Verify workspace isolation is intact               |
| [Import from existing database](../runbooks/schema-import-from-existing.md)        | Onboard a workspace with existing tables           |
| [Export for handoff](../runbooks/schema-export-for-handoff.md)                     | Export a schema for the customer to take elsewhere |
