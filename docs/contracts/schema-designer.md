# Schema Designer — User Guide

The schema designer is the first user-facing feature of the platform. It lets you define, version, and deploy database schemas visually — on PostgreSQL, MSSQL, or MongoDB — without writing DDL by hand.

---

## Getting started

### Creating your first schema

1. Open the **Data Management** section from the workspace sidebar.
2. Click **New schema**.
3. Choose a starter template or start blank:
   - **Blank** — one empty `items` table
   - **CRM** — contacts, companies, deals, activities
   - **Blog** — posts, authors, categories, comments
   - **Task tracker** — projects, tasks, users, comments
   - **E-commerce** — customers, products, orders, order items
4. Give your schema a name and a slug (URL-safe identifier, unique within the workspace).
5. Choose the database driver: **Postgres**, **MSSQL**, or **MongoDB**.

The slug cannot be changed after creation. Choose it carefully — it becomes part of the customer database namespace (`cust_<slug>`).

---

## The three views

The schema designer offers three views of the same underlying model. You can switch between them freely; they always reflect the same state.

### Diagram view

A visual graph of tables and their relationships. Drag tables to arrange them. Click a table to expand its columns. Drag from one column to another to create a foreign key.

Foreign keys show as arrows between tables. Hover an arrow to see the constraint details (ON DELETE / ON UPDATE actions).

### Table view

A list of all tables in the schema. Click a table to expand its columns, indexes, and constraints. Faster for editing many tables sequentially; better for keyboard-driven workflows.

### Code view

The schema as a YAML document (JSON also supported). For power users who prefer text editing. Copy-paste from here to diff in version control, share with colleagues, or bulk-import a schema.

---

## Editing a schema

Changes are **draft-only** until you save. The platform validates as you type and shows inline errors (red underlines) and warnings (yellow). You can save with warnings; errors block save.

### Adding a table

- Diagram view: click **Add table** in the toolbar, or double-click the canvas.
- Table view: click **+ Add table** at the bottom of the list.
- Code view: add a table entry in YAML.

Table names must be `lowercase_snake_case`. Reserved words for the active database are rejected.

### Adding a column

- Click the **+** next to the table header in Diagram or Table view.
- Choose a type from the type picker. The picker only shows types supported by the active database driver (see [capability matrix](../architecture/capability-matrix.md)).

### PII tagging

If a column name matches a PII heuristic (`email`, `phone`, `name`, `address`, `ssn`, `tax_id`, `date_of_birth`, etc.), the platform prompts:

> _"This column name suggests it may contain personal data. Is it PII?"_

Options:

- **Yes, it's PII** — choose a category (identification, contact, financial, health, biometric, behavioral, location, other).
- **No, it's not PII** — add a brief justification. The justification is stored in schema metadata.

PII-tagged columns appear in compliance exports (GDPR Article 15 access requests) and are candidates for erasure workflows (Article 17).

### Foreign keys

- Drag from the source column to the target column in Diagram view.
- Or use the **Edit foreign key** dialog in Table view.

Set `ON DELETE` and `ON UPDATE` actions. On MongoDB, foreign keys are advisory — the platform stores the relationship in metadata but the database doesn't enforce it. A warning banner makes this explicit.

### Indexes

Add indexes from the table's **Indexes** tab. Partial indexes (with a `WHERE` clause) are available on Postgres and MSSQL. On Mongo, partial indexes use `partialFilterExpression`.

---

## The save flow: validate → preview → apply

Every schema change goes through four phases:

**1. Edit** — make changes in any view. Nothing is saved yet.

**2. Validate** — click **Save**. The platform runs full validation: naming rules, type compatibility, foreign key integrity, PII checks. Errors appear inline. Warnings appear but don't block.

**3. Preview** — for changes that affect a deployed schema, the platform shows the migration plan: the exact DDL statements it will run, estimated duration, and any destructive changes (highlighted in red). Review before proceeding.

**4. Apply** — confirm the migration. The platform executes the DDL, shows live progress, and confirms success. If the migration fails, it attempts automatic rollback.

---

## Schema versioning

Every successful apply creates an immutable version record. The **History** panel shows the full version list:

```
v1  Initial schema — users, posts
v2  Added comments table
v3  Renamed posts.title → posts.heading
v4  Rolled back to v2 (reversed v3)
```

### Viewing a past version

Click any version in the History panel to see a read-only diff against the current schema.

### Rolling back

1. Open the History panel.
2. Click **Roll back to this version** on any past version.
3. The platform generates a migration plan that reverses the changes.
4. Review the plan — rollback for destructive changes (dropped columns, dropped tables) restores the schema shape but **cannot recover the data**. The platform makes this explicit.
5. Confirm. A new version is created (rollback never edits history).

---

## Exporting a schema

From the schema's action menu, choose **Export**:

- **Markdown** — a human-readable table spec, suitable for project documentation.
- **JSON** — the full schema model, suitable for re-import or processing.
- **YAML** — the Code view format.

The exported document always reflects the current version.

---

## Importing a schema

From the workspace's schema list, click **Import schema**:

1. Paste or upload JSON or YAML.
2. Choose the target database driver.
3. The platform validates the import, reports any issues, and creates a new schema.

Importing from an existing live database (introspection-based import) is documented in the [schema-import-from-existing](../runbooks/schema-import-from-existing.md) runbook.

---

## Concurrent editing

Multiple users can edit the same schema. The platform uses optimistic locking:

- The first person to save wins.
- The second person sees a conflict: _"This schema was modified by another user. Here's what changed."_
- The second person can merge manually or discard their changes.

Real-time presence (showing which fields other users are editing) is planned for a future release.

---

## Permissions

| Action                   | Roles                                                    |
| ------------------------ | -------------------------------------------------------- |
| View schemas             | owner, admin, architect, developer, qa, reviewer, viewer |
| Create / edit schemas    | owner, admin, architect                                  |
| Deploy (apply migration) | owner, admin, architect                                  |
| Rollback                 | owner, admin, architect                                  |
| Export                   | owner, admin, architect, developer, qa, reviewer, viewer |
| Import                   | owner, admin, architect                                  |
| Delete                   | owner, admin                                             |

Workspace approval routing applies to **deploy** and **rollback**. In solo workspaces, the architect or owner deploys directly. In enterprise workspaces with approval configuration, changes route to a designated approver list before deployment.

---

## Capability differences by database

The schema designer adjusts its UI to the active database driver. Features not supported on the chosen driver are disabled with an explanation. See the [capability matrix](../architecture/capability-matrix.md) for the full breakdown.

Key differences:

- **Array columns** — available on Postgres and MongoDB; not available on MSSQL.
- **Foreign key enforcement** — enforced on Postgres and MSSQL; advisory-only on MongoDB.
- **Row-level security** — available on Postgres only.
- **Schema namespacing** — Postgres and MSSQL use database schemas (`cust_<slug>`); MongoDB uses collection prefixes (`cust_<slug>__`).

---

## Troubleshooting

| Symptom                         | Likely cause                                       | Action                                                                                             |
| ------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Migration stuck                 | Long-running lock on a large table                 | Follow [schema-stuck-migration](../runbooks/schema-stuck-migration.md) runbook                     |
| Rollback would lose data        | Rolled-back version dropped a column that had data | Follow [schema-rollback-data-loss](../runbooks/schema-rollback-data-loss.md) runbook               |
| Schema X visible in workspace Y | Isolation breach — critical                        | Follow [schema-cross-workspace-isolation](../runbooks/schema-cross-workspace-isolation.md) runbook |
| Conflict on save                | Another user saved first                           | Reload, review diff, merge manually                                                                |
| "Reserved word" error           | Column or table name conflicts with a DB keyword   | Rename; see reserved word list in the error tooltip                                                |
