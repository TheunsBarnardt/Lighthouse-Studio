# Runbook: Microsoft Entra ID (Azure AD) Identity Provider Setup

Configure the platform to authenticate users via Microsoft Entra ID (formerly Azure Active Directory).

---

## 1. Register an app in Entra

1. Go to **Azure portal → Entra ID → App registrations → New registration**.
2. Name: `Platform (your deployment name)`.
3. Supported account types: choose based on your scenario:
   - _Single tenant_ → "Accounts in this organizational directory only"
   - _Multi-tenant_ → "Accounts in any organizational directory"
4. Redirect URI: Web → `https://yourdomain.com/api/auth/oidc/callback/entra`
5. Click **Register**.

---

## 2. Create a client secret

1. App registrations → your app → **Certificates & secrets** → New client secret.
2. Set an expiry (recommend 12 months; calendar a rotation reminder).
3. Copy the **Value** immediately (not shown after leaving the page).

---

## 3. Note the identifiers

From the app's Overview page:

- **Application (client) ID** → `ENTRA_CLIENT_ID`
- **Directory (tenant) ID** → `ENTRA_TENANT_ID`

---

## 4. Grant API permissions (for group sync)

If `groupSync: true` is needed:

1. **API permissions** → Add a permission → Microsoft Graph → Application permissions → `GroupMember.Read.All`.
2. Click **Grant admin consent** for your tenant.

---

## 5. Set environment variables

| Variable              | Value                                |
| --------------------- | ------------------------------------ |
| `ENTRA_TENANT_ID`     | Directory (tenant) ID from step 3    |
| `ENTRA_CLIENT_ID`     | Application (client) ID from step 3  |
| `ENTRA_CLIENT_SECRET` | Secret value from step 2             |
| `ENTRA_TOKEN_SECRET`  | 32-byte HMAC secret for state tokens |

---

## 6. Configure the adapter

```typescript
import { EntraIdentityProvider } from '@platform/adapter-identity-entra';
import { InMemoryFlowStore } from '@platform/adapter-identity-builtin';

const entra = new EntraIdentityProvider(
  {
    id: 'entra',
    displayName: 'Microsoft (Work Account)',
    tenantId: process.env.ENTRA_TENANT_ID,
    clientId: process.env.ENTRA_CLIENT_ID,
    clientSecret: process.env.ENTRA_CLIENT_SECRET,
    redirectUri: 'https://yourdomain.com/api/auth/oidc/callback/entra',
    tokenSecret: process.env.ENTRA_TOKEN_SECRET,
    groupSync: true,
    justInTimeProvisioning: true,
  },
  stateStore, // your OidcStateStore implementation
);
```

---

## 7. Client secret rotation

Before expiry:

1. Create a new client secret in Azure (do not delete the old one yet).
2. Deploy the new `ENTRA_CLIENT_SECRET` to all instances.
3. After confirming sign-ins work, delete the old secret in Azure.

---

## 8. Verify

1. Navigate to the sign-in page and click "Sign in with Microsoft".
2. Complete the Microsoft sign-in flow.
3. Verify the user record was created in `identity_users` with the correct `primary_email`.
4. If `groupSync: true`, check that `groups` appears in the session metadata.
