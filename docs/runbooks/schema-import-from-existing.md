# Runbook: Import Schema from an Existing Database

**Use case:** A customer wants to use the Data Management Module with an existing database. They don't have a schema in the platform designer yet. They want the designer to reflect their current database structure.

**Estimated time:** 30 minutes to a few hours depending on database complexity.

## Prerequisites

- The customer has a workspace configured on the platform
- The workspace's database driver is set to match the customer's existing database (postgres/mssql/mongo)
- The customer's database is accessible from the platform (network path open, credentials available)
- The customer has `schema.import` permission in their workspace

## Step 1: Run schema introspection

Use the platform's introspection tooling to capture the current database structure.

### Via the UI (preferred)

1. Navigate to the workspace → Data Management → Schemas
2. Click "Import from existing database"
3. Provide the connection details for the existing database
4. The platform runs `SchemaIntrospectionPort.listTables()` and `describeTable()` for each table
5. Review the generated schema before importing — the platform creates a draft `CustomerSchema` without applying it

### Via the API

```bash
# Introspect and produce a schema JSON draft
curl -X POST /api/workspaces/<workspace_id>/schemas/introspect \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "connectionUrl": "postgresql://user:pass@host:5432/dbname",
    "targetNamespace": "public"
  }'

# Response: { "schema": { ... CustomerSchema JSON ... } }
# Save the output for review
```

## Step 2: Review and clean up the imported schema

The introspected schema will be mechanically correct but may need manual cleanup:

1. **PII tagging**: the introspection process identifies columns with PII-heuristic names and marks them for review. Go through the PII prompts in the schema designer.

2. **Descriptions**: add table and column descriptions for documentation generation.

3. **Advisory FKs on Mongo**: if importing from MongoDB, foreign keys are inferred from application conventions, not database constraints. Review them for accuracy.

4. **Reserved names**: if any table or column names conflict with platform reserved words (the validator will flag these), you'll need to rename them in the platform's view. The actual database names are not changed unless you redeploy.

5. **Custom types**: if the source database uses custom types (Postgres enums, MSSQL user-defined types), these appear as `text` or `string` in the import. Review and update to the appropriate normalized type.

## Step 3: Import (without deploying)

The import creates a `CustomerSchema` record in the platform WITHOUT applying it to the database. The schema has no `deployed_version` yet.

```bash
curl -X POST /api/workspaces/<workspace_id>/schemas/import \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "format": "json",
    "content": "<JSON from Step 1>",
    "databaseDriver": "postgres",
    "name": "Main schema"
  }'
```

## Step 4: Mark as "already deployed"

Because the schema exists in the real database (the customer's existing database), the platform needs to know this. Set the `deployed_version` to match the imported version so the designer doesn't try to re-apply everything:

```sql
-- Postgres / MSSQL: mark the schema as deployed at version 1
UPDATE customer_schemas
SET last_deployed_version = current_version,
    last_deployed_at = NOW()
WHERE id = '<schema_id>';
```

This tells the schema designer that the database reflects the current version. Future changes will generate migration plans against this baseline.

## Step 5: Verify alignment

Use the platform's drift detection (when implemented) or manually compare:

```bash
# Compare the platform's view of the schema against the live database
curl /api/workspaces/<workspace_id>/schemas/<schema_id>/drift-report \
  -H "Authorization: Bearer $TOKEN"
```

If drift is detected, investigate whether the introspection captured everything correctly.

## Step 6: Reconfigure the customer's database connection

The customer's application should now connect through the platform's auto-generated APIs (Objective 12) rather than directly to the database. Configure the customer's `cust_<slug>_app` role to have the same grants as their current application user.

```sql
-- Postgres: grant existing application user's permissions to the customer app role
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA cust_<slug> TO cust_<slug>_app;
```

## Troubleshooting

**"Column type not recognized"**: The introspected type doesn't map to a `NormalizedType`. The platform imports it as `text` and flags a warning. Review and update the type in the designer.

**"Table name is a reserved word"**: The existing table name conflicts with a database reserved word or platform reserved prefix. In the designer, give it an alias; the platform will use the alias for all generated artifacts while the underlying table keeps its original name (this is tracked in the schema metadata).

**"Foreign key references an unknown table"**: The referenced table was not included in the introspection scope (e.g., it's in a different schema). Either expand the introspection scope or mark the FK as advisory.
