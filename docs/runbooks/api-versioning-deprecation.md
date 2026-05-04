# Runbook: Deprecating an Old API Version After a Schema Change

**Audience:** Platform operators, workspace admins
**Relates to:** Objective 12, ADR-0099

---

## Overview

When a customer deploys a schema change that removes or renames a column, clients still using the old column name will receive errors. The platform's URL-path versioning (`/api/v1/data/...`) allows a transition window: the old schema version remains accessible at the old version path while clients migrate to the new one.

This runbook covers the process of managing that transition.

---

## How Schema Versioning Works

Every deployed schema has a version number (e.g., `v3`). The platform's API always serves the **latest deployed version** at the `/api/v1/data/:workspace/:schema/...` path.

When a breaking change is deployed (e.g., column `phone_number` renamed to `phone`):

- The new schema is version `v4`.
- Requests arrive with `?schema_version=3` or the old column name in filters → error.
- Clients must update to use the new column name.

In practice, the platform does not currently serve multiple schema versions simultaneously on different URL prefixes — all requests go to the latest deployed version. The `v1` in `/api/v1/...` refers to the platform API version, not the schema version.

**What this means for breaking schema changes:** They are breaking. The platform does not automatically translate old column names to new ones.

---

## Before a Breaking Schema Change: Pre-Migration Checklist

1. **Identify all API consumers.** Check the audit log for `data_management.api.*` events on the schema. Unique `actor.id` values are your consumers.

2. **Notify consumers.** Give them a cutover date. Recommended: at least 2 weeks for external consumers, 1 week for internal.

3. **Additive changes first, then removals.** If renaming `phone_number` → `phone`, consider:

   - Deploy v4 with BOTH `phone_number` and `phone` columns (computed / aliased).
   - Give clients time to migrate to `phone`.
   - Deploy v5 removing `phone_number`.

4. **Test the new schema in a staging workspace.** Deploy the breaking change to staging first. Confirm that migrated clients work correctly.

---

## Deploying the Breaking Change

Schema deployment is done via the Schema Designer UI or the platform admin API. The migration planner will warn on destructive changes (column removal, type change).

```bash
POST /api/v1/admin/schemas/<schema_id>/deploy
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "changeSummary": "Rename phone_number to phone (breaking)",
  "allowDestructive": true
}
```

`allowDestructive: true` is required for breaking changes. This is a safety gate — never set it without going through the pre-migration checklist.

After deployment:

- The schema cache (TTL: 60 seconds) is invalidated on all instances.
- New requests see the new schema within 60 seconds.
- The `PerWorkspaceRepositoryFactory` cache is also invalidated.

---

## After the Breaking Change: Monitor for Errors

Watch for:

```promql
rate(platform_api_validation_errors_total{workspace="acme", error_code="unknown_field"}[5m]) > 0
```

`unknown_field` errors from the filter parser indicate clients using removed column names in filters. `400` errors with `"code": "VALIDATION"` in the response body indicate clients sending removed columns in request bodies.

---

## Handling Clients That Didn't Migrate

If a client is still using the old schema after the cutover:

1. Contact the client owner (from the actor ID in the audit log).
2. If they cannot migrate immediately, consider whether you can roll back the schema change (only possible if the migration is reversible and the rollback window is still open — see the rollback runbook).
3. As a last resort, you can temporarily add the old column back as an alias in the schema. This is a schema change itself and goes through the same process.

---

## OpenAPI Spec Refresh

After a breaking schema change, the workspace's OpenAPI spec at `/api/v1/data/<workspace>/openapi.json` is automatically regenerated (it's generated on demand from the live schema). Any SDK generated from the old spec is now stale.

Advise customers to:

1. Fetch the new OpenAPI spec.
2. Regenerate their SDK (Objective 19).
3. Update their application code.

The spec includes the schema version in the `info.version` field, so customers can confirm they have the latest spec.
