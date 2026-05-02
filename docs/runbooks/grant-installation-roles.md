# Runbook: Granting Installation-Level Roles

**Purpose:** Grant `installation_owner`, `installation_admin`, or `installation_auditor` to a user.

**When to use:** Initial platform setup; adding a new operations team member; granting audit access to a compliance officer.

**Who can run this:** An existing `installation_owner`.

---

## Prerequisites

- Access to the platform's database (Postgres, MSSQL, or Mongo)
- The user's `id` from the `users` table (run: `SELECT id FROM users WHERE primary_email = '<email>'`)

---

## Steps

### 1. Verify the user exists

```sql
-- Postgres / MSSQL
SELECT id, primary_email, status FROM users WHERE primary_email = '<email>';
```

```javascript
// MongoDB
db.users.findOne({ primary_email: '<email>' }, { _id: 1, status: 1 });
```

Expected: one row with `status = 'active'`.

### 2. Check existing installation role assignments

```sql
-- Postgres / MSSQL
SELECT user_id, role, _created_at
FROM installation_role_assignments
WHERE user_id = '<user-id>'
  AND _archived_at IS NULL;
```

```javascript
// MongoDB
db.installation_role_assignments.find({ user_id: '<user-id>', _archived_at: null });
```

### 3. Insert the role assignment

Use the platform's `MemberService` or direct DB insert (for bootstrap scenarios only).

```sql
-- Postgres
INSERT INTO installation_role_assignments
  (id, user_id, role, granted_by_user_id, _created_at, _updated_at)
VALUES
  (gen_random_uuid(), '<user-id>', 'installation_admin', '<granting-user-id>', NOW(), NOW());
```

```sql
-- MSSQL
INSERT INTO [dbo].[installation_role_assignments]
  ([id], [user_id], [role], [granted_by_user_id], [_created_at], [_updated_at])
VALUES
  (NEWSEQUENTIALID(), '<user-id>', 'installation_admin', '<granting-user-id>', SYSDATETIMEOFFSET(), SYSDATETIMEOFFSET());
```

```javascript
// MongoDB
db.installation_role_assignments.insertOne({
  _id: new UUID(),
  user_id: '<user-id>',
  role: 'installation_admin',
  granted_by_user_id: '<granting-user-id>',
  _version: 1,
  _archived_at: null,
  _created_at: new Date(),
  _updated_at: new Date(),
  _created_by: '<granting-user-id>',
  _updated_by: '<granting-user-id>',
});
```

### 4. Verify

Re-run the check in Step 2. Confirm the new row is present.

### 5. Notify the user

The user's next login session will pick up the installation role (roles are loaded at authentication time).

---

## Revoking an Installation Role

```sql
-- Postgres
UPDATE installation_role_assignments
SET _archived_at = NOW(), _updated_at = NOW()
WHERE user_id = '<user-id>'
  AND role = 'installation_admin'
  AND _archived_at IS NULL;
```

The user's active sessions will have stale installation roles until they re-authenticate. For immediate revocation, also invalidate their sessions:

```sql
-- Postgres
UPDATE sessions
SET _archived_at = NOW()
WHERE user_id = '<user-id>'
  AND _archived_at IS NULL;
```

---

## Notes

- `installation_owner` is the most privileged role. Assign it to at most 2-3 users.
- `installation_auditor` is read-only across all workspaces. Assign to compliance officers.
- These roles do not grant access to workspace _data_. An installation admin who is not a workspace member cannot read workspace projects.
