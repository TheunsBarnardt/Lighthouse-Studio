# Runbook: Verify Cross-Workspace Schema Isolation

**Severity:** Critical — isolation failure means customer data leakage
**When to run:** After infrastructure changes, after restoring a database backup, before any new deployment to production

## What this verifies

1. Workspace A's application role CANNOT read or write Workspace B's customer tables
2. Workspace A's application role CANNOT read or write platform-internal tables
3. The schema designer for Workspace A does not surface Workspace B's schema definitions
4. Schema introspection for Workspace A returns only Workspace A's tables

## Automated verification (run first)

```bash
# Run the full cross-tenant isolation test suite
pnpm test --filter=@platform/tests-cross-tenant

# Or run the schema-specific isolation tests
pnpm test --filter=@platform/tests-cross-tenant -- --grep "schema isolation"
```

If all tests pass, isolation is confirmed. Stop here.

If tests fail, proceed with manual verification below.

## Manual verification: Postgres

### Setup

Identify two test workspaces with deployed schemas. If none exist, create them:

```bash
# Via the API or CLI (replace with actual workspace slugs)
WORKSPACE_A="acme"
WORKSPACE_B="globex"
SCHEMA_A="cust_${WORKSPACE_A}"
SCHEMA_B="cust_${WORKSPACE_B}"
APP_ROLE_A="cust_${WORKSPACE_A}_app"
APP_ROLE_B="cust_${WORKSPACE_B}_app"
```

### Verify A cannot read B's tables

```sql
-- Connect as the app role for workspace A
SET ROLE "cust_acme_app";

-- Attempt to read from workspace B's schema (should FAIL with permission denied)
SELECT * FROM "cust_globex"."users" LIMIT 1;
-- Expected: ERROR: permission denied for schema cust_globex

-- Attempt to read from the platform schema (should FAIL)
SELECT * FROM public.workspaces LIMIT 1;
-- Expected: ERROR: permission denied for table workspaces
```

### Verify A can read its own tables

```sql
SET ROLE "cust_acme_app";

-- Read from workspace A's own tables (should SUCCEED)
SELECT * FROM "cust_acme"."users" LIMIT 1;
-- Expected: success (or empty result if no rows)
```

### Verify platform tables are unreachable

```sql
SET ROLE "cust_acme_app";

-- Attempt each platform table (should all FAIL)
SELECT * FROM customer_schemas LIMIT 1;
SELECT * FROM audit_log LIMIT 1;
SELECT * FROM workspace_roles LIMIT 1;
-- Expected: all fail with permission denied
```

## Manual verification: MSSQL

```sql
-- Execute as workspace A's app role
EXECUTE AS ROLE = 'cust_acme_app';

-- Should FAIL
SELECT TOP 1 * FROM [cust_globex].[users];
-- Expected: The SELECT permission was denied on the object 'users', database '...', schema 'cust_globex'

-- Should SUCCEED
SELECT TOP 1 * FROM [cust_acme].[users];

REVERT;
```

## Manual verification: MongoDB

MongoDB isolation is by collection naming convention (prefix) and application-level filtering, not database-level grants. Verify:

```js
// Connect with the installation's app user (not a workspace-specific user)
// Verify the query for Workspace A's schema only returns Workspace A's schemas

db.customer_schemas.find({ workspace_id: '<workspace_a_id>' }).toArray();
// All results should have workspace_id matching Workspace A — inspect each

// Verify an attempt to read Workspace B's collections from Workspace A's code path
// would be blocked by the service layer's workspace scoping check
// This is tested in the cross-tenant test suite
```

## API-level isolation check

Even with DB-level isolation, verify the service layer enforces workspace scoping:

```bash
# Get a token for workspace A
TOKEN_A=$(curl -s -X POST /api/auth/signin -d '{"email":"user@acme.com","password":"..."}' | jq -r '.token')

# Attempt to read workspace B's schema using workspace A's token
# Replace SCHEMA_B_ID with an actual schema ID from workspace B
curl -H "Authorization: Bearer $TOKEN_A" \
     -H "X-Workspace-Id: <workspace_a_id>" \
     /api/schemas/<SCHEMA_B_ID>

# Expected: 404 Not Found (the service returns 404 for cross-workspace access to avoid leaking existence)
```

## If isolation is broken

**Stop all customer access immediately.** Schema isolation failure is a critical security incident.

1. Notify the security team
2. Engage the incident response process
3. Identify the root cause (role misconfiguration, migration bug, code bug)
4. Fix and re-verify before restoring access
5. Audit all schema operations in the affected time window:

```sql
SELECT * FROM audit_log
WHERE event_type LIKE 'data_management.schema.%'
  AND occurred_at > '<incident_start>'
ORDER BY occurred_at DESC;
```
