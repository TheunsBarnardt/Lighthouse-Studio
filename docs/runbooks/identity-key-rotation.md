# Runbook: Identity Key Rotation

Procedures for rotating cryptographic keys and parameters used by the identity system.

**Schedule a maintenance window.** Key rotation requires a deployment and may temporarily affect sign-in during the transition.

---

## 1. Session token HMAC secret rotation

The `AUTH_TOKEN_SECRET` is used to HMAC-SHA256 session tokens before storage. **Rotating it invalidates all existing sessions** (no token can be verified against the new secret).

**Steps:**

1. Generate a new secret:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
2. During a maintenance window, update `AUTH_TOKEN_SECRET` in the deployment environment.
3. Delete all existing sessions before deploying (or accept that all users will be signed out on their next request):
   ```sql
   DELETE FROM identity_sessions;
   ```
4. Deploy the new secret.
5. Verify sign-in works with a test account.

**Zero-downtime alternative:** Not feasible for this secret — the old tokens cannot be verified with the new secret. Plan for a maintenance window.

---

## 2. Flow token HMAC secret rotation (email verification, password reset, magic link)

The `AUTH_FLOW_SECRET` signs short-lived flow tokens (15 min–24 hr TTL). Rotating it invalidates any in-flight email verification, password reset, or magic link tokens.

**Steps:**

1. Advise users that any pending email links will be invalidated.
2. Generate a new secret and update `AUTH_FLOW_SECRET`.
3. Deploy. New tokens will be signed with the new secret; old tokens will fail validation.
4. Users with invalidated tokens should request a new one.

---

## 3. TOTP encryption key rotation (AES-256-GCM)

The `mfa-totp-encryption-key` encrypts stored TOTP secrets. Rotating this key requires re-encrypting all stored TOTP secrets.

**Steps:**

1. Generate a new AES-256 key:
   ```bash
   node -e "const {generateKey} = require('./packages/adapters/identity-builtin/dist/src/index.js'); console.log(generateKey())"
   ```
2. Write a migration script that:
   - Reads each `mfa_ciphertext` from `identity_credentials`.
   - Decrypts with the old key.
   - Re-encrypts with the new key.
   - Writes the new ciphertext back.
3. Run the migration script (off-peak; it processes one row at a time to avoid lock contention).
4. Update `AUTH_MFA_ENCRYPTION_KEY` in the deployment.
5. Deploy. New enrollments will use the new key; existing secrets were already migrated.

**Script template:**

```typescript
import { encrypt, decrypt } from '@platform/adapter-identity-builtin';

const oldKey = process.env.OLD_MFA_KEY!;
const newKey = process.env.NEW_MFA_KEY!;

const rows = await pool.query('SELECT user_id, mfa_ciphertext FROM identity_credentials WHERE mfa_ciphertext IS NOT NULL');

for (const row of rows.rows) {
  const plaintext = decrypt(row.mfa_ciphertext, oldKey);
  const newCiphertext = encrypt(plaintext, newKey);
  await pool.query('UPDATE identity_credentials SET mfa_ciphertext = $1 WHERE user_id = $2', [newCiphertext, row.user_id]);
}
```

---

## 4. Password hash parameter upgrade

When argon2id parameters are increased (e.g., memory from 64 MiB to 128 MiB), existing hashes need to be upgraded. The platform does this transparently on next successful login (`needsRehash` → rehash on verify).

**To force all users to re-hash at login:**

1. Increment `CURRENT_VERSION` in `packages/adapters/identity-builtin/src/password.ts`.
2. Deploy. On each successful password sign-in, the platform re-hashes with the new parameters.
3. Users who do not sign in retain the old hash indefinitely. This is acceptable — their accounts remain protected by the old parameters.

**To force immediate upgrade** (e.g., after a parameter security advisory):

There is no way to re-hash without the plaintext password. The only option is to force a password reset for all users:

```sql
-- Invalidate all passwords by clearing their hashes (force reset on next sign-in attempt)
-- WARNING: This locks out all users until they complete a password reset.
UPDATE identity_credentials
SET password_hash = NULL, password_version = NULL, password_algorithm = NULL;
```

Only do this if the current parameters are believed to be insufficient for your threat model.

---

## 5. SAML / OIDC signing certificates

See the provider-specific runbooks:

- `identity-provider-config-saml.md` — Section 7: Signing certificate rotation
- `identity-provider-config-entra.md` — Section 7: Client secret rotation
