# Runbook: Data Subject Erasure Request (GDPR Article 17)

_For handling requests from individuals to delete or anonymize personal data the platform holds about them._

---

## Purpose

Under GDPR Article 17, individuals have the right to erasure ("right to be forgotten"). This runbook covers how to fulfill erasure requests using the platform's built-in erasure service.

**GDPR deadline:** Respond within **30 days** of receiving the request.

**Important:** Some data is **retained** even after erasure (audit log references, legally required records). This is documented below and in the personal data registry. Do not promise "complete deletion" — be accurate about what is deleted and what is retained with documented justification.

---

## Who May Submit a Request

1. **The user themselves** — via `/account/privacy → Delete My Account and Data`
2. **An installation admin** — acting on behalf of a user
3. **A user's legal representative** — contact the installation admin, who verifies identity

---

## What Happens During Erasure

### Immediate (on request)

- The user account is **soft-deleted** — they can no longer sign in
- Pending invitations are cancelled

### After the grace period (default: 30 days)

Fields are processed per the [personal data registry](../compliance/personal-data-registry.md):

| Data                                   | Action                                                            |
| -------------------------------------- | ----------------------------------------------------------------- |
| `users.primary_email`                  | Anonymized: `deleted-user-{hash}@platform.invalid`                |
| `users.display_name`                   | Anonymized: `Deleted User`                                        |
| `users.avatar_url`                     | Deleted                                                           |
| `users.preferences`                    | Deleted                                                           |
| `user_credentials.password_hash`       | Deleted                                                           |
| `user_credentials.mfa_totp_secret`     | Deleted                                                           |
| `user_credentials.recovery_codes`      | Deleted                                                           |
| `sessions.user_id`                     | All sessions deleted                                              |
| `external_identities.provider_subject` | Deleted                                                           |
| `workspace_members.user_id`            | Anonymized (record retained for workspace audit continuity)       |
| `workspace_invitations.email`          | Deleted (expired invitations)                                     |
| `audit_log.actor_id`                   | **Retained** — user record anonymized; audit events keep the UUID |
| `audit_log.actor_email_snapshot`       | **Retained** — forensic record of identity at time of event       |
| `audit_log.ip_address`                 | **Retained** — security forensics                                 |

### What is explicitly NOT erased

- Audit log events (the event records themselves remain intact — forensic integrity)
- Records under legal hold
- Financial records (if any)

---

## Procedure

### Step 1: Verify the request

- Confirm identity of requester
- Check for any legal hold on the user's data (see [legal-hold.md](./legal-hold.md))
- Note: if a legal hold is active, the erasure request is accepted but execution is paused pending hold removal

### Step 2: Initiate erasure (user self-service)

User navigates to **Account → Privacy → Delete My Account and Data**, confirms, and the erasure request is submitted.

### Step 3: Initiate erasure (admin-initiated)

**Via the admin UI:**

1. Navigate to **Installation → User Directory**
2. Find the user
3. Select **Actions → Process Erasure Request**
4. Review the summary of what will be deleted vs. retained
5. Confirm

**Via the API:**

```bash
TARGET_USER_ID="user-uuid-here"

curl -s -X POST \
  -H "Authorization: Bearer $INSTALLATION_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"targetUserId\": \"$TARGET_USER_ID\"}" \
  https://your-platform/api/v1/installation/data-subject/erasure-requests \
  | jq .
```

Response:

```json
{
  "erasureId": "erasure_abc123",
  "status": "grace_period",
  "targetUserId": "...",
  "accountSoftDeletedAt": "2026-05-02T14:00:00Z",
  "hardDeleteScheduledAt": "2026-06-01T14:00:00Z",
  "gracePeriodDays": 30
}
```

### Step 4: Communicate to the requester

Inform the data subject:

1. Their account has been deactivated immediately (cannot sign in)
2. Personal data will be deleted/anonymized on `hardDeleteScheduledAt`
3. Some data is retained with legal justification (audit log references — provide explanation)
4. They will receive confirmation when erasure is complete

**Template:**

> We have received your erasure request. Your account has been deactivated and you will no longer be able to sign in. Your personal data will be deleted or anonymized by [date]. Some data is retained as required by law — specifically, references in audit logs are retained as forensic records of platform operations, as required under our legal obligations for security and compliance purposes. You will receive a confirmation when the erasure process is complete.

### Step 5: Monitor progress

```bash
curl -s -H "Authorization: Bearer $INSTALLATION_ADMIN_TOKEN" \
  https://your-platform/api/v1/installation/data-subject/erasure-requests/erasure_abc123 \
  | jq '{status, hardDeleteScheduledAt, completedAt}'
```

Statuses: `grace_period` → `executing` → `completed`

### Step 6: Confirm completion

When status is `completed`, an `data.subject.erasure_completed` audit event is emitted. Retrieve it for your records:

```bash
curl -s -H "Authorization: Bearer $INSTALLATION_AUDITOR_TOKEN" \
  "https://your-platform/api/v1/installation/audit?eventType=data.subject.erasure_completed" \
  | jq '.items[0]'
```

The audit event includes a summary: how many fields were deleted, how many were anonymized, and how many were retained with justification.

---

## Retracting an Erasure Request (during grace period)

If the user changes their mind within the grace period:

```bash
curl -s -X DELETE \
  -H "Authorization: Bearer $INSTALLATION_ADMIN_TOKEN" \
  https://your-platform/api/v1/installation/data-subject/erasure-requests/erasure_abc123
```

This cancels the hard-delete job and restores the user's account to active. The request and retraction are both audited.

After the grace period, erasure cannot be cancelled.

---

## Legal Hold Override

If the user's workspace has an active legal hold, erasure execution is automatically paused after the soft-delete step. The audit log records the reason. Erasure resumes automatically when the hold is lifted.

Communicate this to the requester: their account is deactivated and their data will be erased when the legal hold is lifted. Document the legal hold and the data subject request.

---

## Record Keeping

| Date | User ID | Requested By | Grace Period End | Completed | Fields Deleted | Fields Anonymized | Fields Retained |
| ---- | ------- | ------------ | ---------------- | --------- | -------------- | ----------------- | --------------- |
|      |         |              |                  |           |                |                   |                 |

Retain these records as evidence for your GDPR compliance program.
