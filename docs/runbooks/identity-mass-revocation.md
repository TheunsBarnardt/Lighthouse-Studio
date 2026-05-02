# Runbook: Mass Session Revocation

Revoke all sessions for a workspace or the entire installation. Used when a credential leak or security incident requires forcing all users to re-authenticate.

---

## Scenario A: Revoke all sessions for a specific user

```sql
DELETE FROM identity_sessions WHERE user_id = '<user-id>';
```

All active tokens for the user are immediately invalidated.

---

## Scenario B: Revoke all sessions in a specific workspace

Sessions are workspace-scoped via `workspace_id`:

```sql
DELETE FROM identity_sessions WHERE workspace_id = '<workspace-id>';
```

All users in that workspace will be signed out on their next request.

---

## Scenario C: Revoke all sessions in the entire installation

**Warning:** All users on the platform will be signed out immediately. Communicate before taking this action if possible.

```sql
DELETE FROM identity_sessions;
```

Or, if you want to preserve very recently created sessions (e.g., during an active deployment):

```sql
DELETE FROM identity_sessions WHERE created_at < NOW() - INTERVAL '1 minute';
```

---

## Scenario D: Revoke all sessions created with a specific identity provider

Use this when an IdP configuration is compromised (e.g., a SAML signing cert is leaked):

```sql
DELETE FROM identity_sessions WHERE identity_provider = '<provider-id>';
```

---

## Scenario E: Revoke sessions older than a certain age

Force all users to re-authenticate with sessions older than 30 days:

```sql
DELETE FROM identity_sessions WHERE created_at < NOW() - INTERVAL '30 days';
```

---

## After mass revocation

1. **Communicate with users**: send an email or in-app notification explaining that they have been signed out and why. Reducing confusion reduces support load.

2. **Monitor re-authentication rate**: check sign-in metrics over the following hour to confirm users can re-authenticate successfully.

3. **Check for locked accounts**: a spike in failed sign-ins after a mass revocation may indicate users attempting to sign back in and triggering lockout. Monitor:

   ```sql
   SELECT COUNT(*) FROM identity_credentials WHERE lockout_until > NOW();
   ```

4. **Review the root cause**: mass revocation is a response to a security event. Document why it was necessary and implement preventive measures.

---

## Scheduled revocation (session cleanup)

Expired sessions are cleaned up automatically by the nightly cleanup job (`SessionPort.cleanupExpired()`). This runbook is for emergency revocation of _active_ (non-expired) sessions.
