# Runbook: Export a Schema for Handoff

**Use case:** A customer wants to take their schema outside the platform — for documentation, for handoff to another team, for use with an external tool, or to move to a self-managed database setup.

**Estimated time:** 5–15 minutes.

## Export formats

The platform exports schemas in three formats:

| Format   | Use case                                                                                |
| -------- | --------------------------------------------------------------------------------------- |
| Markdown | Human-readable documentation; include in project wikis, READMEs, or handoff packages    |
| JSON     | Machine-readable; reimport into another platform installation or parse programmatically |
| YAML     | Alternative machine-readable format; preferred by some toolchains                       |

A fourth export type — **diagram PNG/SVG** — is available from the schema designer's Diagram view (File → Export Diagram).

## Export via the UI

1. Navigate to the workspace → Data Management → Schemas
2. Select the schema to export
3. Click the "Export" button (top-right of the schema designer)
4. Choose format: Markdown / JSON / YAML
5. Click Download

The export captures the schema at its **current version** (including any unsaved changes in the edit buffer — wait for auto-save or manually save before exporting if you want the latest committed version).

## Export via the API

```bash
# Export as Markdown
curl /api/workspaces/<workspace_id>/schemas/<schema_id>/export?format=markdown \
  -H "Authorization: Bearer $TOKEN" \
  -o schema.md

# Export as JSON
curl /api/workspaces/<workspace_id>/schemas/<schema_id>/export?format=json \
  -H "Authorization: Bearer $TOKEN" \
  -o schema.json

# Export as YAML
curl /api/workspaces/<workspace_id>/schemas/<schema_id>/export?format=yaml \
  -H "Authorization: Bearer $TOKEN" \
  -o schema.yaml
```

## What the export includes

**JSON/YAML exports** include the complete `CustomerSchema` structure: all table definitions, column types, indexes, foreign keys, constraints, PII tags, and metadata (version, driver, workspace info).

**Markdown exports** include:

- Schema name and description
- Database driver
- Current version and last deployed timestamp
- A table for each `TableDefinition`: column names, types, nullable, PII classification
- A list of indexes and foreign keys per table
- Does NOT include internal IDs (stable identifiers) — those are platform-internal

## Exporting a historical version

To export a specific historical version (not the current one):

```bash
# List available versions
curl /api/workspaces/<workspace_id>/schemas/<schema_id>/versions \
  -H "Authorization: Bearer $TOKEN"

# Export version 3
curl /api/workspaces/<workspace_id>/schemas/<schema_id>/versions/3/export?format=json \
  -H "Authorization: Bearer $TOKEN" \
  -o schema_v3.json
```

## Handoff checklist

Before handing off a schema to a customer or external team:

- [ ] Export is at the correct version (check `version` field in the JSON)
- [ ] PII column classifications have been reviewed and are accurate
- [ ] Table and column descriptions have been filled in (for documentation value)
- [ ] Foreign keys have been reviewed (especially for Mongo: advisory FKs are noted as such)
- [ ] Capability-specific features (RLS policies, full-text search config) are documented separately if the receiving system doesn't support them

## Re-importing an exported schema

A JSON or YAML export can be re-imported into another workspace or installation using the import flow:

```bash
curl -X POST /api/workspaces/<new_workspace_id>/schemas/import \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "format": "json",
    "content": "<contents of schema.json>",
    "databaseDriver": "postgres",
    "name": "Imported schema"
  }'
```

The import generates new stable IDs for all tables and columns (the original IDs are platform-internal and workspace-scoped). After import, the schema is in "never deployed" state — run through the preview and apply flow to materialize it in the new database.

## Audit trail

Every export is recorded in the audit log:

```sql
SELECT * FROM audit_log
WHERE event_type = 'data_management.schema.exported'
  AND workspace_id = '<workspace_id>'
ORDER BY occurred_at DESC;
```

This record includes the exporter's identity, the schema version exported, and the format. If a customer claims they didn't receive the export, the audit log shows exactly what was exported and when.
