# Runbook: Quarterly Audit Chain Integrity Drill

_Run at least once per quarter. Record results in your ops log. Required for SOC 2 CC4.1._

---

## Purpose

Verify that the audit log hash chain is intact across all workspaces and has not been tampered with or silently corrupted. This drill confirms both that the audit log is sound and that the verification infrastructure itself is working.

---

## Prerequisites

- Access to an `installation_auditor` account (or equivalent database read access for the manual path)
- The platform API or CLI accessible
- At least 10 minutes of uninterrupted time (longer for large installations)

---

## Procedure

### Step 1: Identify workspaces to verify

For a full drill, verify all workspaces. For a spot-check, verify a representative sample (at minimum: the oldest 3 workspaces, the highest-activity workspace, and a recently created workspace).

```bash
# List all workspace IDs via the admin API
curl -s -H "Authorization: Bearer $INSTALLATION_AUDITOR_TOKEN" \
  https://your-platform/api/v1/installation/workspaces \
  | jq '.[].id'
```

### Step 2: Run chain verification

For each workspace ID, call the verify endpoint:

```bash
WORKSPACE_ID="your-workspace-id"

curl -s -X POST \
  -H "Authorization: Bearer $INSTALLATION_AUDITOR_TOKEN" \
  -H "Content-Type: application/json" \
  https://your-platform/api/v1/workspaces/$WORKSPACE_ID/audit/verify-chain \
  | jq .
```

Expected successful output:

```json
{
  "workspaceId": "...",
  "verifiedAt": "2026-05-02T14:00:00Z",
  "eventsVerified": 12847,
  "status": "intact"
}
```

### Step 3: Verify the installation chain

The installation-level event chain (workspace_id = null, stored under the zero UUID) must also be verified:

```bash
curl -s -X POST \
  -H "Authorization: Bearer $INSTALLATION_AUDITOR_TOKEN" \
  https://your-platform/api/v1/installation/audit/verify-chain \
  | jq .
```

### Step 4: Record results

For each workspace verified, record:

| Workspace ID   | Events Verified | Status            | Verified At | Notes |
| -------------- | --------------- | ----------------- | ----------- | ----- |
| (workspace id) | (count)         | intact / tampered | (timestamp) |       |

Save this table in your ops log.

### Step 5: Confirm the drill itself is audited

The verification operation emits an `audit.chain.verified` event. Confirm it appears in the audit log:

```bash
curl -s -H "Authorization: Bearer $INSTALLATION_AUDITOR_TOKEN" \
  "https://your-platform/api/v1/installation/audit?eventType=audit.chain.verified&occurredAfter=$(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%SZ)" \
  | jq '.items[] | {id, occurredAt, actorId, metadata}'
```

---

## If Verification Fails

If any workspace reports `"status": "tampered"`, the response includes:

```json
{
  "status": "tampered",
  "tamperedAt": {
    "sequence": 4821,
    "expectedHash": "a3f1...",
    "actualHash": "b9c2..."
  }
}
```

**Immediately follow the [`audit-storage-corruption.md`](./audit-storage-corruption.md) runbook.**

Do not continue with other workspaces until you understand the scope of the issue.

---

## Performance Expectations

| Events in Chain | Expected Duration |
| --------------- | ----------------- |
| < 10,000        | < 5 seconds       |
| 100,000         | < 30 seconds      |
| 1,000,000       | < 5 minutes       |

Verification that takes significantly longer may indicate a query plan issue or missing index.

---

## Scheduling

This drill is performed:

- **Quarterly** (scheduled; document the next scheduled date below)
- **After any database restore** (before declaring restore complete)
- **After a suspected security incident** (as part of incident response)
- **After any direct database maintenance** that touched the audit tables

Next scheduled drill: _(update with actual date)_

---

## Recording Completion

After a successful drill, create a brief ops log entry:

```
Audit chain integrity drill — YYYY-MM-DD
Performed by: [name]
Workspaces verified: [count]
Total events verified: [count]
Result: All chains intact
Next drill scheduled: [date]
```

File this under your SOC 2 evidence artifacts.
