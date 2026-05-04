# Runbook: API Key Compromise Incident Response

**Audience:** Platform operators, security team
**Relates to:** Objective 12, ADR-0102

---

## Overview

An API key compromise is when a `pkey_*` token is observed in an unauthorized context — leaked in logs, a public repository, a security scan, or a customer report. This runbook covers immediate containment, investigation, and remediation.

**Time is critical.** Every minute a compromised key is active, the attacker can read or modify the workspace's data. Start with Step 1 immediately.

---

## Step 1: Revoke the Key Immediately

If you know the key ID or the key prefix:

**Via platform admin API:**

```bash
POST /api/v1/admin/api-keys/<key_id>/revoke
Authorization: Bearer <admin_token>
```

Or, if you only have the raw key or prefix, find the key ID first:

```bash
GET /api/v1/admin/workspaces/<workspace_id>/api-keys?prefix=<first_8_chars>
Authorization: Bearer <admin_token>
```

Then revoke by ID. Revocation is **instant and permanent** — the key cannot be unrevoked.

**Confirm revocation:** Make a test request with the compromised key. It must return `401 Unauthorized` with `"detail": "API key has been revoked"`.

---

## Step 2: Determine the Blast Radius

Query the audit log for all events by the compromised key since it was last known safe:

```bash
GET /api/v1/admin/audit?actor_id=<key_id>&from=<last_known_safe_timestamp>
Authorization: Bearer <admin_token>
```

Look for:

- `data_management.api.row_created` / `row_updated` / `row_hard_deleted` — data modifications
- `data_management.api.bulk_created` / `bulk_deleted` — bulk operations
- `data_management.api.read_denied` — attempted access to restricted resources (may indicate probing)

Note: read operations (`data_management.api.*`) are not audited by default. If the workspace has elevated audit disabled, you will not see read events. Assume the attacker read everything the key had access to.

---

## Step 3: Determine Permissions

Check what the compromised key was authorized to do:

```bash
GET /api/v1/admin/api-keys/<key_id>
Authorization: Bearer <admin_token>
```

If `permissions` is `null`, the key inherited the creating user's permissions at the time of creation. Check the creating user's current permission set (it may have changed).

Scope the investigation to the tables the key could access.

---

## Step 4: Assess Data Integrity

For any tables where the key had write access:

1. Compare current row counts to backups from before the incident time.
2. If `row_hard_deleted` events exist, those rows are gone — restore from backup.
3. For modified rows (`row_updated`, `bulk_updated`), identify what changed. The audit event includes `metadata.changes` if the workspace has elevated audit enabled.

If soft-delete is used (`row_archived`), the archived rows are still in the database with `_archived_at` set. They can be restored via the API.

---

## Step 5: Notify the Workspace Owner

Inform the workspace owner:

- When the key was compromised (approximate time window)
- What operations were performed (from the audit log)
- What data may have been exposed or modified
- What you've done (revoked the key)
- What they need to do (review their data, rotate any downstream credentials if the key was used to fetch them)

---

## Step 6: Root Cause and Prevention

Identify how the key leaked:

- **In code repository:** Scan the repo with a secret scanning tool. Set up pre-commit hooks to prevent future leaks.
- **In logs:** Review logging configuration to ensure API keys are not logged in Authorization headers.
- **In monitoring/tracing:** Check that trace spans don't capture Authorization header values.
- **Employee access:** If a team member with key access was terminated, this should have been caught in the offboarding process.

---

## Step 7: Issue Replacement Key

After the incident is contained and the root cause is addressed:

1. Issue a new API key for the affected workspace.
2. Update the application or integration to use the new key.
3. Confirm normal operation is restored.

---

## Key Facts

- API keys are stored as HMAC-SHA-256 hashes. Even if the database is exfiltrated, the attacker cannot recover the raw key from the hash alone (they would need the installation HMAC secret too).
- The raw key is displayed **exactly once** at creation. There is no recovery path.
- Revocation is immediate — no cache TTL to wait for.
