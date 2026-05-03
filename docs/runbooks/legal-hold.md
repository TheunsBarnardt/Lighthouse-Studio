# Runbook: Legal Hold

_For placing and removing legal holds on workspace data, and understanding the effects on retention and erasure._

---

## Purpose

A legal hold (litigation hold) instructs the platform to preserve all data for a workspace beyond normal retention periods. It is used when litigation, regulatory investigation, or audit requires that data not be deleted until the matter is resolved.

**Who can manage legal holds:** `installation_admin` or `installation_owner` role holders only.

---

## Effects of a Legal Hold

When a workspace is under legal hold:

| Process               | Normal Behavior                            | Under Legal Hold                                                          |
| --------------------- | ------------------------------------------ | ------------------------------------------------------------------------- |
| Retention enforcement | Deletes events older than retention policy | **Skipped** — no deletions                                                |
| Data subject erasure  | Hard-deletes after grace period            | **Paused** — soft-delete proceeds; hard-delete deferred until hold lifted |
| Workspace deletion    | Soft-delete + scheduled hard-delete        | **Paused** — soft-delete may proceed; data not destroyed                  |
| Cold archive          | Archives per schedule                      | Continues (archival is safe)                                              |

All skipped retention runs are themselves logged as `audit.retention.enforced` events with `outcome: 'failure'` and a `reason` field explaining the hold.

---

## Procedure: Placing a Legal Hold

### Via admin UI

1. Sign in as `installation_admin` or `installation_owner`
2. Navigate to **Installation → Workspaces**
3. Select the affected workspace
4. Under **Compliance → Legal Hold**, click **Place Hold**
5. Enter the reason (required): case reference, investigation name, or brief description
6. Confirm

### Via API

```bash
WORKSPACE_ID="target-workspace-uuid"

curl -s -X POST \
  -H "Authorization: Bearer $INSTALLATION_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Litigation hold: Case ref XYZ-2026-001. Do not remove without authorization from Legal."
  }' \
  https://your-platform/api/v1/workspaces/$WORKSPACE_ID/legal-hold \
  | jq .
```

The hold placement is audited as `system.config.changed` with metadata recording the reason.

### Confirm hold is active

```bash
curl -s -H "Authorization: Bearer $INSTALLATION_ADMIN_TOKEN" \
  https://your-platform/api/v1/workspaces/$WORKSPACE_ID \
  | jq '{legalHold}'
```

Expected:

```json
{
  "legalHold": {
    "active": true,
    "placedAt": "2026-05-02T14:00:00Z",
    "placedBy": "admin-user-id",
    "reason": "Litigation hold: Case ref XYZ-2026-001..."
  }
}
```

---

## Procedure: Removing a Legal Hold

**Before removing a hold, confirm with your legal team that the matter is resolved and data preservation is no longer required.**

### Via admin UI

1. Navigate to **Installation → Workspaces → [workspace] → Compliance → Legal Hold**
2. Click **Remove Hold**
3. Enter the reason for removal: case resolution reference or legal authorization
4. Confirm

### Via API

```bash
curl -s -X DELETE \
  -H "Authorization: Bearer $INSTALLATION_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Case XYZ-2026-001 settled. Legal authorization received 2026-04-30."}' \
  https://your-platform/api/v1/workspaces/$WORKSPACE_ID/legal-hold \
  | jq .
```

The hold removal is audited.

### What happens after removal

- Normal retention enforcement resumes at the next scheduled run
- Paused data subject erasure requests resume (hard-delete scheduled for original grace period end, or immediately if the grace period has already elapsed)
- No retroactive deletion of data that accumulated during the hold — retention enforcement only applies going forward from the next scheduled run

---

## Legal Hold and Data Subject Erasure Conflicts

If a data subject submits an erasure request and a legal hold is active on their workspace:

1. The account is immediately soft-deleted (user cannot sign in)
2. Hard-delete is deferred until the legal hold is lifted
3. The data subject is notified that their erasure will be completed when the hold is lifted
4. When the hold is lifted, erasure resumes automatically

You must communicate this to the data subject, citing the legal basis for the delay. This is a legitimate reason under GDPR Article 17(3)(e) (data processed for the establishment, exercise or defence of legal claims).

---

## Audit Evidence

All hold placements, hold removals, and skipped retention runs are recorded in the audit log. For legal proceedings, export the audit trail with:

```bash
# All legal hold events for a workspace
curl -s -H "Authorization: Bearer $INSTALLATION_AUDITOR_TOKEN" \
  "https://your-platform/api/v1/workspaces/$WORKSPACE_ID/audit?eventType=system.config.changed,audit.retention.enforced" \
  | jq '.items[] | select(.metadata.configKey == "legal_hold" or .metadata.reason != null)'
```

---

## Coordination Checklist

- [ ] Legal team has authorized the hold
- [ ] Hold placed via admin UI or API
- [ ] Reason documented with case/investigation reference
- [ ] Affected workspace owners notified (if appropriate to your context)
- [ ] Ongoing: no data deleted during hold; verify next retention run skipped
- [ ] When matter resolved: legal authorization to remove hold obtained
- [ ] Hold removed; reason documented
- [ ] Affected data subject erasure requests (if any) resumed
- [ ] Records filed in legal matter documentation
