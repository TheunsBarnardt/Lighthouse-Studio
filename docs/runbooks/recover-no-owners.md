# Runbook: Recovering from a Workspace with No Owners

**Purpose:** Restore owner access to a workspace that has no active `workspace_owner` member.

**When to use:** All workspace owners were removed, archived, or deactivated, leaving the workspace without anyone who can manage it.

**Who can run this:** An `installation_owner` or `installation_admin`.

---

## Detection

A workspace is orphaned if:

- Its `owner_user_id` references a user who has been archived or removed
- No active `workspace_member` row with a `workspace_owner` role assignment exists

### Query to detect orphaned workspaces (Postgres)

```sql
SELECT w.id, w.name, w.slug, w.owner_user_id
FROM workspaces w
WHERE w._archived_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM workspace_members wm
    JOIN workspace_member_roles wmr ON wmr.workspace_member_id = wm.id AND wmr._archived_at IS NULL
    JOIN workspace_roles wr ON wr.id = wmr.role_id AND wr._archived_at IS NULL
    WHERE wm.workspace_id = w.id
      AND wm.status = 'active'
      AND wm._archived_at IS NULL
      AND wr.name = 'workspace_owner'
  );
```

---

## Recovery Steps

### 1. Choose a recovery user

Identify a user (usually an `installation_owner`) who will temporarily hold ownership.

```sql
SELECT id, primary_email FROM users WHERE status = 'active' LIMIT 5;
```

### 2. Add the user as a workspace member (if not already)

```sql
-- Postgres
INSERT INTO workspace_members
  (id, workspace_id, user_id, status, invited_at, accepted_at, _created_at, _updated_at)
VALUES
  (gen_random_uuid(), '<workspace-id>', '<user-id>', 'active', NOW(), NOW(), NOW(), NOW())
ON CONFLICT (workspace_id, user_id) DO UPDATE
  SET status = 'active', _updated_at = NOW(), _archived_at = NULL;
```

### 3. Look up the workspace_owner role ID

```sql
SELECT id FROM workspace_roles
WHERE name = 'workspace_owner'
  AND builtin = TRUE
  AND _archived_at IS NULL;
```

### 4. Assign the workspace_owner role to the member

```sql
-- Get the member's ID first
SELECT id FROM workspace_members
WHERE workspace_id = '<workspace-id>' AND user_id = '<user-id>' AND _archived_at IS NULL;

-- Then grant the role
INSERT INTO workspace_member_roles
  (id, workspace_member_id, role_id, granted_by_user_id, _created_at, _updated_at)
VALUES
  (gen_random_uuid(), '<member-id>', '<workspace-owner-role-id>', '<granting-user-id>', NOW(), NOW());
```

### 5. Update the workspace's owner_user_id denormalized field

```sql
UPDATE workspaces
SET owner_user_id = '<user-id>', _updated_at = NOW()
WHERE id = '<workspace-id>';
```

### 6. Notify the workspace's team

Email the workspace's original members that access has been restored and they should reassign ownership to an appropriate team member.

### 7. Transfer ownership to the right person (optional)

Once a team member is available, use `WorkspaceService.transferOwnership()` to hand ownership to them, then remove the recovery user if appropriate.

---

## Notes

- This operation bypasses the `OwnerSelfOrphanError` guard because it's a recovery path that runs directly against the database.
- All changes should be followed by an audit log entry. If the platform is running, the next mutation via the service layer will generate audit events.
- If the workspace itself is corrupted beyond recovery, contact the installation owner to archive and recreate it.
