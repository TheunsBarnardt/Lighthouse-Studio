# Runbook: Switching Adapter Drivers

How to switch a deployed environment from one adapter to another — for example, from local storage to S3, or from builtin auth to OIDC.

**Important:** Adapter switching in production requires careful planning. Data migration may be needed. Never switch adapters in production without first testing the procedure in staging.

---

## Storage adapter: local → S3

**Scenario:** You're moving from local file storage to Backblaze B2 (or any S3-compatible provider).

### Step 1: Provision the S3 bucket

In your S3 provider (B2, AWS, Wasabi):

- Create a bucket: e.g., `platform-dev-storage`
- Create an application key with read/write access to that bucket
- Note the endpoint URL, region, access key, secret key

### Step 2: Migrate existing files (if any)

If the current local storage has files, copy them to the S3 bucket:

```bash
# Using rclone (install: https://rclone.org/install/)
rclone copy /var/platform/storage s3:platform-dev-storage --progress
```

Verify the files are in the bucket before switching.

### Step 3: Update Coolify environment variables

In the environment's Coolify resource settings:

```
STORAGE_DRIVER=s3
STORAGE_S3_ENDPOINT=https://s3.us-west-000.backblazeb2.com  # omit for AWS
STORAGE_S3_REGION=us-west-000
STORAGE_S3_BUCKET=platform-dev-storage
STORAGE_S3_ACCESS_KEY=<key>
STORAGE_S3_SECRET_KEY=<secret>
STORAGE_S3_PATH_STYLE=false  # true for MinIO/self-hosted
```

### Step 4: Redeploy

Trigger a redeploy. Check `/_status` — the storage adapter should report `healthy: true`.

### Step 5: Verify

- Upload a file through the platform UI
- Verify it appears in the S3 bucket
- Download the file through the platform UI
- Verify it matches the uploaded file

---

## Identity adapter: builtin → OIDC

**Scenario:** An enterprise customer is switching from built-in auth to their corporate OIDC provider (e.g., Microsoft Entra ID).

### Warning

This is a destructive operation for existing sessions. All users must re-authenticate after the switch.

### Step 1: Configure the OIDC provider

In your OIDC provider (Entra ID, Auth0, Okta, etc.):

- Register the platform as an OAuth/OIDC application
- Set the redirect URI: `https://dev.<DOMAIN>/auth/callback`
- Note the issuer URL, client ID, and client secret

### Step 2: Plan user migration

If the platform has existing users with the `builtin` driver, those users' identities are internal. After switching to OIDC, they will authenticate via the external provider.

Options:
a) Link existing accounts by email (user logs in via OIDC; platform matches by email)
b) Start fresh (delete existing user data; not recommended for prod)

### Step 3: Update environment variables

```
IDENTITY_DRIVER=oidc
OIDC_ISSUER_URL=https://login.microsoftonline.com/<tenant-id>/v2.0
OIDC_CLIENT_ID=<app-client-id>
OIDC_CLIENT_SECRET=<app-client-secret>
OIDC_REDIRECT_URI=https://dev.<DOMAIN>/auth/callback
```

### Step 4: Redeploy and verify

After redeploy:

- Log in via the OIDC flow
- Verify the redirect, token exchange, and session creation work
- Verify existing user accounts are accessible

---

## Database adapter switching

Database adapter switching in production is a major migration. Do not attempt without a detailed migration plan. Contact the maintainer. This runbook covers only the adapter selection change, not the data migration itself.

---

## Rolling back a failed adapter switch

If the new adapter fails health checks:

1. In Coolify, revert the changed environment variables to the previous values
2. Trigger a redeploy
3. Verify `/_status` returns `ok: true` with the original adapter
4. Investigate the failure before re-attempting
