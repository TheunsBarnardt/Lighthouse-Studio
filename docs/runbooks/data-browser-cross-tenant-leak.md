# Runbook: Data Browser — Cross-Tenant Data Leak Investigation

**Symptom:** A user reports that they can see data rows that belong to a different workspace, or data from a table they should not have access to within their workspace. This is a **P0 security incident**. Follow this runbook immediately and escalate in parallel.

---

## IMMEDIATE: Escalate Now

Before investigating, notify the security channel:

```
@security-oncall POTENTIAL DATA LEAK — data browser — workspace <id> — [brief description]
User report: <what the user saw>
Time reported: <timestamp>
```

Do not wait for investigation results before escalating. Investigation and escalation run in parallel.

---

## 1. Preserve Evidence

Before touching any logs or configuration, capture the current state:

```bash
# Snapshot relevant access logs for the incident window
cp /var/log/platform/web.log /tmp/incident-<date>-web.log
cp /var/log/platform/access.log /tmp/incident-<date>-access.log
```

Note the approximate time the user observed the leak, the affected workspace ID, and the affected user ID. All subsequent investigation should reference these.

---

## 2. Check RequestContext.workspaceId in Query Logs

Every data query issued through the `PersistencePort` must include a `workspace_id` filter (ADR-0055). The workspace ID is injected from `RequestContext` at the service layer.

Search access logs for the suspect request:

```bash
grep '"userId":"<user_id>"' /var/log/platform/web.log \
  | grep '"route":"/api/v1/data"' \
  | grep -E '"timestamp":"<incident_timestamp_window>"' \
  | jq '{traceId: .traceId, workspaceId: .workspaceId, query: .db_query}'
```

Verify that `workspaceId` in the log matches the user's workspace. If a query log entry shows a `workspaceId` that does not match the authenticated user's workspace, this is a confirmed scoping failure.

---

## 3. Check the Authorization Service Audit Log

Every data read goes through `authz.check()`. The audit log records authorization decisions:

```sql
SELECT event_time, user_id, workspace_id, action, resource_type, resource_id, decision
FROM audit_log
WHERE event_time BETWEEN '<start>' AND '<end>'
  AND user_id = '<suspect_user_id>'
  AND action LIKE 'data.%'
ORDER BY event_time;
```

If the audit log shows `decision = 'allow'` for a resource in a different workspace, the RBAC layer has a bug. This is a critical finding — document and escalate immediately.

If the audit log shows `decision = 'deny'` but the user still saw the data, there may be a bypass in the data browser's rendering layer (client-side data from a previous request was incorrectly shown).

---

## 4. Check workspace_id Column Presence

All customer data tables are required to have a `workspace_id` column that filters all queries. Confirm the affected table has this column:

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'cust_<slug>'
  AND table_name = '<table_name>'
  AND column_name = 'workspace_id';
```

If this column is **missing**, the table bypasses workspace scoping at the database level. This is a schema defect:

1. Do not add the column immediately (the data may need audit first).
2. Document the missing column as a finding.
3. Restrict access to the affected table via the RBAC layer as a temporary measure.
4. Plan a safe migration to add and backfill the column.

---

## 5. Check for Cache Poisoning

The data browser uses React Query for client-side cache. If a user switched workspaces in the same browser tab without a full page reload, stale data from workspace A may have been displayed while authenticated to workspace B.

Inspect the browser's memory cache:

- Ask the user: "Did you switch workspaces recently without reloading the page?"
- Check if `workspace_id` is part of the React Query cache key for data requests. In the source: `packages/web/src/features/data-browser/hooks/useTableRows.ts` — the query key must include `workspaceId`.

If the cache key is missing `workspaceId`, this is a client-side bug. Patch immediately: add `workspaceId` to the query key array. All users should hard-reload after the patch to clear stale caches.

---

## 6. Confirm or Rule Out Active Leak

Based on the investigation:

**If the leak is confirmed** (data from workspace B was served to workspace A's user):
- Restrict write access to the affected workspace(s) immediately pending full investigation.
- Notify affected workspace owners per your data breach notification policy.
- Preserve all logs; do not rotate until the incident is closed.
- Prepare a post-incident report for security review.

**If the leak is ruled out** (client-side stale data, user error, or a false report):
- Document the findings clearly.
- Notify the reporting user with an explanation.
- Confirm with security oncall that the incident is closed.

---

## Prevention

- Run the workspace scoping conformance tests (Objective 6 test suite) on every PR that touches query construction.
- `dependency-cruiser` rules must prevent adapter code from constructing queries without workspace context.
- Add an integration test that explicitly verifies cross-workspace isolation: create two workspaces with the same table name, insert distinct rows, and assert that a user in workspace A cannot retrieve rows from workspace B.
- Monitor for anomalous cross-workspace patterns: alert if a single session's requests reference more than one `workspace_id`.
