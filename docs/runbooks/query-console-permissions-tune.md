# Runbook: Query Console Permission Tuning

**Purpose:** Guide workspace admins in configuring query console permissions appropriately for their team.

## Default Permission State

| Permission           | Granted by default to                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------ |
| `query.read`         | `workspace_owner`, `workspace_admin`, `architect`, `developer`, `qa`, `reviewer`, `viewer` |
| `query.write`        | **Nobody** (must be explicitly granted)                                                    |
| `query.long_running` | `workspace_owner`, `workspace_admin`                                                       |
| `query.large_result` | `workspace_owner`, `workspace_admin`                                                       |
| `query.export`       | `workspace_owner`, `workspace_admin`, `architect`, `developer`                             |

## Granting `query.write`

Only grant to roles where write access is genuinely required (e.g., a DBA role, a data engineering role).

1. Navigate to Workspace → Settings → Roles
2. Select or create the target role
3. Add permission: `query.write`
4. Document the business justification in the role description

**Do not grant `query.write` to viewer or reviewer roles.**

## Adjusting Timeout and Row Limits

Default limits are set conservatively:

- Timeout: 30 seconds
- Row limit: 1,000 rows

To allow longer queries:

- Grant `query.long_running` — users can then request up to 5 minutes
- Grant `query.large_result` — users can then request up to 100,000 rows

## Audit Review

Review console usage periodically:

```sql
SELECT user_id, count(*) as queries, sum(rows_affected) as total_rows_affected
FROM query_history
WHERE workspace_id = '<id>'
  AND created_at > now() - interval '7 days'
GROUP BY user_id
ORDER BY total_rows_affected DESC;
```

Flag any user executing large write operations consistently — they may need a dedicated integration user instead of the console.

## Emergency Permission Revocation

To revoke all console access for a user immediately:

1. Workspace → Members → select user → remove all roles
2. Or: remove `query.read` from all their roles

The revocation takes effect on the next API call — no restart required.
