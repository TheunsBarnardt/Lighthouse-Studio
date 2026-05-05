# Signed URL Leak Incident Response

**Audience:** On-call engineer / security team  
**Severity:** High — potential unauthorized file access

---

## Overview

A signed URL grants time-limited, unauthenticated access to a specific file. If a URL is leaked (posted publicly, found in a log, accidentally emailed), it must be revoked immediately and the scope of exposure assessed.

---

## 1. Identify Which URLs Were Leaked

Start with the report or alert. Get the full URL and extract the `jti` (JWT ID) or token from the query string. Then query the DB:

```sql
-- Find signed URL record by token prefix or storage key
SELECT
  id,
  workspace_id,
  storage_object_id,
  created_by,
  expires_at,
  revoked_at,
  created_at,
  access_mode
FROM signed_urls
WHERE token = '<token>'
   OR storage_object_id IN (
     SELECT id FROM storage_objects WHERE storage_key = '<storage_key>'
   )
ORDER BY created_at DESC;
```

Note the `id`, `workspace_id`, `storage_object_id`, and `expires_at`.

---

## 2. Immediate Revocation

Revoke the URL by setting `revoked_at`:

```sql
UPDATE signed_urls
SET revoked_at = NOW()
WHERE id = '<signed_url_id>';
```

The platform's URL validation middleware checks `revoked_at` on every request; the URL is blocked immediately. No cache invalidation is needed for the application layer.

**If the URL was exposed for an extended period**, also revoke all other active URLs for the same file as a precaution:

```sql
UPDATE signed_urls
SET revoked_at = NOW()
WHERE storage_object_id = '<object_id>'
  AND revoked_at IS NULL
  AND expires_at > NOW();
```

---

## 3. Assess the Scope

Determine the blast radius:

```sql
-- How many times was this URL accessed? (from access log)
SELECT COUNT(*), MIN(accessed_at), MAX(accessed_at)
FROM signed_url_access_log
WHERE signed_url_id = '<signed_url_id>';

-- What file was exposed?
SELECT storage_key, size_bytes, content_type, workspace_id
FROM storage_objects
WHERE id = '<storage_object_id>';
```

Determine whether the file contains PII, credentials, or other sensitive content. This determines whether a breach notification is required.

---

## 4. Customer Communication

Notify the workspace owner:

- What file was exposed
- Approximate time window of exposure
- Whether access logs show the URL was actually fetched by external parties
- That the URL has been revoked

Coordinate with the account team on whether a formal breach notification is needed based on file content and jurisdiction.

---

## 5. Post-Incident: Review TTL Settings and Direct-Mode Usage

After the incident is contained:

1. **Review TTL settings** for the workspace. Shorter TTLs limit exposure windows:

   ```sql
   SELECT signed_url_ttl_seconds FROM storage_settings
   WHERE workspace_id = '<workspace_id>';
   ```

   Recommend reducing to 900 seconds (15 min) for sensitive workspaces.

2. **Audit direct-mode usage.** URLs with `access_mode = 'direct'` bypass the platform's access log; consider restricting direct mode for sensitive buckets.

3. **Enable URL access logging** if not already active for this workspace.

4. File an internal post-mortem if the exposure window exceeded 1 hour or if the file contained PII.
