# Runbook: Data Subject Access Request (GDPR Article 15)

_For handling requests from individuals to receive a copy of all personal data the platform holds about them._

---

## Purpose

Under GDPR Article 15, individuals have the right to receive a copy of all personal data held about them, along with supplementary information (purposes, retention periods, etc.). This runbook covers the operational steps for fulfilling such a request using the platform's built-in data subject access service.

**GDPR deadline:** The platform must respond within **30 days** of receiving the request. The platform's export service targets completion within **24 hours**.

---

## Who May Submit a Request

1. **The user themselves** — via their account settings at `/account/privacy`
2. **An installation admin** — acting on behalf of a user (e.g., for a user who has lost access to their account)
3. **A user's legal representative** — contact the installation admin, who verifies identity before acting

---

## Procedure

### Step 1: Verify the request is legitimate

Before initiating an export:

- Confirm the requester's identity (platform account login, or out-of-band verification for third-party representatives)
- Confirm the requester has the right to this data (is this their own data, or do they have documented authority to request on behalf of someone else?)
- Log the receipt of the request with date/time and how identity was verified

### Step 2: Initiate the export (user self-service)

If the user is submitting for themselves:

1. User navigates to **Account → Privacy → Download My Data**
2. Platform initiates the export job
3. User receives a notification when complete (typically within 24 hours)
4. User downloads from the secure link (valid 7 days)

### Step 3: Initiate the export (admin-initiated)

If an admin is acting on behalf of a user:

**Via the admin UI:**

1. Navigate to **Installation → User Directory**
2. Find the user by email or ID
3. Select **Actions → Request Data Export**
4. Confirm — this initiates the export and notifies the user

**Via the API:**

```bash
TARGET_USER_ID="user-uuid-here"

curl -s -X POST \
  -H "Authorization: Bearer $INSTALLATION_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"targetUserId\": \"$TARGET_USER_ID\"}" \
  https://your-platform/api/v1/installation/data-subject/access-requests \
  | jq .
```

Response:

```json
{
  "jobId": "dsexport_abc123",
  "status": "processing",
  "targetUserId": "...",
  "requestedBy": "...",
  "estimatedCompletionAt": "2026-05-02T14:00:00Z"
}
```

### Step 4: Monitor export progress

```bash
curl -s -H "Authorization: Bearer $INSTALLATION_ADMIN_TOKEN" \
  https://your-platform/api/v1/installation/data-subject/access-requests/dsexport_abc123 \
  | jq '{status, completedAt, downloadUrl, expiresAt}'
```

### Step 5: Deliver to the data subject

- If the user has a platform account: they are notified automatically and can download from their account
- For users without account access: download the archive, verify contents, then deliver via a secure channel (encrypted email, secure file share, etc.)
- Do not share the download URL unless you are certain the recipient is the data subject

### Step 6: Confirm the request is audited

Both the request and completion are logged:

```bash
curl -s -H "Authorization: Bearer $INSTALLATION_AUDITOR_TOKEN" \
  "https://your-platform/api/v1/installation/audit?eventType=data.subject.access_requested,data.subject.access_completed&actorId=$TARGET_USER_ID" \
  | jq '.items[] | {occurredAt, eventType, outcome}'
```

---

## What the Export Contains

The export is a structured ZIP archive with a manifest. Contents per the personal data registry:

| Category              | Contents                                           |
| --------------------- | -------------------------------------------------- |
| Profile               | Display name, email, avatar URL, preferences       |
| Authentication        | List of linked identity providers (no credentials) |
| Workspace memberships | All workspaces the user is a member of, with roles |
| Audit log (as actor)  | All events where the user performed an action      |
| Invitations           | Any pending invitations sent to the user           |

The archive does **not** contain:

- Password hashes or MFA secrets (security credentials are excluded from exports)
- Other users' data
- Data the user produced in workspace applications (those are workspace-owned; include separately if required by your context)

---

## Deduplication

If a user submits multiple requests within 7 days, the platform returns the existing export rather than generating a new one. Inform the user if this occurs.

---

## Responding to the Requester

Once the export is delivered, provide the requester with:

1. A link to (or copy of) the export archive
2. A brief summary of what categories are included
3. Contact information for follow-up questions
4. Information about their right to request corrections (Article 16) or erasure (Article 17)

---

## Record Keeping

Maintain a log of all data subject access requests for your own compliance program:

| Date Received | User ID | Requested By | Completed | Delivered | Notes |
| ------------- | ------- | ------------ | --------- | --------- | ----- |
| (date)        | (uuid)  | self / admin | (date)    | (date)    |       |

---

## If the Export Fails

If the job status shows `failed`:

1. Check the worker logs for the job ID
2. Common causes: user has been hard-deleted (export of anonymized data only); database timeout for large accounts
3. Re-trigger the export: `POST /api/v1/installation/data-subject/access-requests` again
4. If failures persist: escalate to engineering; do not miss the 30-day GDPR deadline

**GDPR 30-day deadline is non-negotiable.** If automation fails, produce the export manually by querying the database directly for all records in the personal data registry for the target user ID.
