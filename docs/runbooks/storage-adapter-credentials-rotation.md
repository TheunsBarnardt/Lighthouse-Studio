# Storage Adapter Credentials Rotation

**Audience:** On-call engineer or security team  
**Severity:** Medium (routine hygiene) / High (suspected credential leak)

---

## Overview

Per-workspace storage credentials must be rotated periodically (quarterly minimum) or immediately when a leak is suspected. Each adapter type has a distinct rotation procedure. The goal is zero-downtime rotation: new credentials are verified before old ones are revoked.

---

## 1. Why Rotation Is Needed

- **Periodic hygiene:** credentials age; rotation limits the blast radius of undetected exposure.
- **Suspected leak:** credential appeared in a log, was accidentally committed, or a breach is reported.

For suspected leaks, complete all steps as fast as possible and treat the old credentials as compromised from the start.

---

## 2. Backblaze B2 — Application Key Rotation

1. Log in to the B2 console (or use `b2` CLI) and create a new application key scoped to the workspace bucket:
   ```bash
   b2 create-key --bucket <bucket-name> lighthouse-ws-<workspace_id>-$(date +%Y%m) \
     listBuckets,listFiles,readFiles,writeFiles,deleteFiles
   ```
2. Note the new `keyId` and `applicationKey`.
3. Update the workspace credential record in the DB:
   ```sql
   UPDATE storage_adapter_credentials
   SET key_id = '<new_key_id>',
       secret  = '<new_application_key>',
       rotated_at = NOW()
   WHERE workspace_id = '<workspace_id>'
     AND adapter_type = 'b2';
   ```
4. Verify — trigger a signed-URL generation or a small test upload via the admin API:
   ```bash
   curl -X POST http://localhost:3001/admin/storage/verify-credentials \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -d '{"workspaceId": "<workspace_id>"}'
   ```
5. Revoke the old key in the B2 console once verification passes.

---

## 3. Azure Blob Storage — SAS Token Rotation

Azure SAS tokens have a built-in expiry; rotation means generating a new token with a future expiry and swapping it before the old one expires.

1. In the Azure Portal or via CLI, generate a new SAS token for the workspace container with the appropriate permissions (read, write, delete, list) and an expiry 90 days out:
   ```bash
   az storage container generate-sas \
     --account-name <storage-account> \
     --name <container-name> \
     --permissions rwdl \
     --expiry $(date -d "+90 days" +%Y-%m-%dT%H:%MZ) \
     --output tsv
   ```
2. Update the DB credential record with the new SAS URL.
3. Verify using the admin endpoint above.
4. The old SAS token expires naturally; no explicit revocation needed unless the token was leaked (in which case rotate the storage account key, which invalidates all SAS tokens).

---

## 4. MinIO — User Credential Rotation

1. Generate new credentials via the MinIO admin API or console:
   ```bash
   mc admin user add myminio lighthouse-ws-<workspace_id> <new_secret_key>
   mc admin policy attach myminio lighthouse-bucket-policy \
     --user lighthouse-ws-<workspace_id>
   ```
2. Update the DB credential record.
3. Verify via the admin endpoint.
4. Remove the old MinIO user:
   ```bash
   mc admin user remove myminio lighthouse-ws-<workspace_id>-old
   ```

---

## 5. Rollback if New Credentials Fail

If verification fails:

1. Revert the DB credential record to the previous values (keep them in a temp variable before updating).
2. Confirm writes/reads succeed with the old credentials.
3. Investigate the new credential creation (wrong scope, wrong bucket, typo).
4. Retry from step 1 of the relevant adapter section.
