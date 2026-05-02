# Runbook: Mass Member Revocation

**Purpose:** Immediately revoke access for multiple workspace members (e.g., following a security incident, team restructuring, or employee offboarding batch).

**When to use:**

- Security incident: revoke all members of a compromised workspace while investigation occurs
- Offboarding: a team dissolution where all members must lose access simultaneously
- Workspace quarantine: suspected data exfiltration

**Who can run this:** `workspace_owner` for their own workspace; `installation_admin` for any workspace.

---

## Single-User Revocation (preferred, via API)

For a single user, use `MemberService.remove()`. This goes through authorization and audit.

For bulk operations (many users at once), use the direct DB procedure below.

---

## Bulk Revocation via Database

### Step 1: Identify the members to revoke

```sql
-- Postgres: list all active members in a workspace
SELECT wm.id, wm.user_id, u.primary_email, wm.status
FROM workspace_members wm
JOIN users u ON u.id = wm.user_id
WHERE wm.workspace_id = '<workspace-id>'
  AND wm.status = 'active'
  AND wm._archived_at IS NULL
ORDER BY u.primary_email;
```

Review the list before proceeding. Consider excluding yourself (the operator) if you need continued access.

### Step 2: Archive the member records

```sql
-- Postgres: revoke all (except the operator)
UPDATE workspace_members
SET status = 'archived',
    _archived_at = NOW(),
    _updated_at = NOW()
WHERE workspace_id = '<workspace-id>'
  AND status = 'active'
  AND _archived_at IS NULL
  AND user_id != '<operator-user-id>';
```

```sql
-- MSSQL
UPDATE [dbo].[workspace_members]
SET [status] = 'archived',
    [_archived_at] = SYSDATETIMEOFFSET(),
    [_updated_at] = SYSDATETIMEOFFSET()
WHERE [workspace_id] = '<workspace-id>'
  AND [status] = 'active'
  AND [_archived_at] IS NULL
  AND [user_id] != '<operator-user-id>';
```

```javascript
// MongoDB
db.workspace_members.updateMany(
  {
    workspace_id: '<workspace-id>',
    status: 'active',
    _archived_at: null,
    user_id: { $ne: '<operator-user-id>' },
  },
  {
    $set: {
      status: 'archived',
      _archived_at: new Date(),
      _updated_at: new Date(),
    },
  },
);
```

### Step 3: Invalidate active sessions for revoked users

```sql
-- Postgres: invalidate sessions for all revoked users in one query
UPDATE sessions s
SET _archived_at = NOW()
FROM workspace_members wm
WHERE wm.workspace_id = '<workspace-id>'
  AND wm.status = 'archived'
  AND wm._archived_at IS NOT NULL
  AND wm._archived_at > NOW() - INTERVAL '1 minute'
  AND s.user_id = wm.user_id
  AND s._archived_at IS NULL;
```

### Step 4: Verify

```sql
-- Confirm no active members remain (except the operator)
SELECT COUNT(*) FROM workspace_members
WHERE workspace_id = '<workspace-id>'
  AND status = 'active'
  AND _archived_at IS NULL;
```

Expected: 1 (the operator).

### Step 5: Write a manual audit entry

If the revocation happened outside the platform API, write an audit record:

```sql
-- Postgres
INSERT INTO audit_entries
  (id, workspace_id, actor_id, action, resource_type, resource_id, metadata, occurred_at)
VALUES
  (gen_random_uuid(), '<workspace-id>', '<operator-user-id>',
   'member.mass_revocation', 'workspace', '<workspace-id>',
   '{"reason": "security incident / offboarding", "count": <N>}'::jsonb,
   NOW());
```

---

## Re-enabling Access After a Security Incident

1. Investigate the incident and confirm scope.
2. Re-invite legitimate members via the platform UI (`InvitationService.create()`).
3. Do NOT restore the bulk-archived records — create new membership records for clean audit trail.
4. Review and rotate any API tokens associated with the workspace.

---

## Notes

- The `OwnerSelfOrphanError` guard is not enforced via direct SQL. Ensure at least one owner remains after the revocation.
- Sessions invalidated above expire immediately. Users mid-request will receive a 401 on their next API call.
- This runbook assumes direct database access. For API-based revocation, iterate `MemberService.remove()` per user.
