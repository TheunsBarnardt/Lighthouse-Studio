# ADR-0096: Edit-Validate-Preview-Apply Flow for Schema Changes

**Status:** Accepted
**Date:** 2026-05-03
**Deciders:** solo

## Context

Schema changes to a live database carry significant risk:

- **Data loss**: dropping a column with data in it is irreversible
- **Locking**: adding an index on a large table can block writes for minutes
- **Incompatibility**: changing a column type can truncate values that don't fit the new type
- **Cascade effects**: renaming a column breaks any views, triggers, or application code referencing the old name

Supabase applies schema changes immediately on save. This works for a new project with no data and no traffic. It fails for a production database with real data and real users. The platform targets production workloads; it must be safer than "just run the DDL."

At the same time, schema changes cannot require so many confirmation steps that they become unusable. A developer adding a new table to a fresh schema should not have to navigate four modals.

## Decision

All schema changes — whether authored in the Diagram, Table, or Code view — go through a four-phase flow before they touch the database:

### Phase 1: Edit

The user makes changes in the schema designer. Changes accumulate in a local edit buffer in the browser. Nothing is persisted. Real-time incremental validation flags obvious problems (invalid names, unsupported types) as the user types. The visual state distinguishes "saved" from "unsaved" changes.

### Phase 2: Validate

When the user clicks Save (or auto-save triggers), `SchemaService.validateSchema()` runs the full `SchemaValidator`:

- Naming rules (snake_case, reserved words, length limits)
- Type compatibility with the target database driver
- Foreign key coherence (referenced tables/columns exist)
- Index correctness (indexed columns exist, index makes sense for type)
- PII heuristic checks

If validation fails, the save is rejected with structured errors pointing at specific fields. The user fixes them. There is no partial save.

### Phase 3: Preview (for changes to deployed schemas)

When the user saves a change that affects a schema that has already been deployed (i.e., `deployed_version` is set), `SchemaService.previewMigration()` generates a `MigrationPlan` — the ordered list of DDL steps, estimated durations, destructive change warnings, and blocking change warnings.

The user sees a diff-style preview modal before confirming. Destructive changes (drops, type narrowing) are highlighted in red. Long-running operations are flagged with estimated durations.

For schemas that have never been deployed, the preview phase is skipped — there is nothing in the database to migrate yet.

### Phase 4: Apply

The user confirms the migration. `SchemaService.applyChanges()` runs:

1. Re-validates (in case the schema changed between preview and confirm)
2. Re-plans (idempotent; same plan as the preview)
3. Executes the migration steps via `SchemaMigrationPort`
4. On success: writes the new schema version record, updates `deployed_version`
5. On failure: attempts rollback; if rollback fails, surfaces "operator action required"

The schema designer monitors progress in real-time via the migration progress dialog.

### Auto-save behavior

Auto-save, when enabled per workspace, saves the edit buffer (Phase 2) without triggering a migration (Phases 3–4). The schema is saved as "pending deployment" — changes are recorded in the platform but not yet applied to the database. A separate "Deploy" action triggers Phases 3–4.

## Consequences

**Positive:**

- Users cannot accidentally run a destructive migration without seeing a warning
- Long-running operations are flagged before they start, not discovered during
- The platform's internal schema uses the same migration discipline (Objective 4 family), so the machinery is already proven
- Validation errors are structured and field-addressable (UI can highlight the specific field)

**Negative:**

- Four phases feel like overhead for trivial changes (adding a new table to a fresh schema)
- Auto-save requires careful state management: "saved" and "deployed" are now different states; the UI must communicate this clearly

## Alternatives Considered

**Apply on save, immediate**: rejected — production-hostile. One accidental column drop in a high-traffic table costs data and downtime. A major differentiator of this platform vs. Supabase is that it's safe for production workloads.

**Manual DDL mode (expert mode)**: deferred — power users who want to write raw SQL can do so via the Query Console (Objective 17). The schema designer targets the visual/structured workflow.

**Three phases (skip validate, just preview)**: rejected — validation before preview prevents generating a preview for an invalid schema, which would produce misleading or unparseable DDL.
