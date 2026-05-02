# Runbook: Generic OIDC Identity Provider Setup

Configure the platform to authenticate users via any OIDC-compliant provider (Okta, Auth0, Keycloak, Ping Identity, etc.).

---

## 1. Discover the OIDC endpoints

Your IdP's well-known configuration is at:

```
{issuer}/.well-known/openid-configuration
```

Example for Keycloak:

```
https://auth.yourdomain.com/realms/platform/.well-known/openid-configuration
```

The platform fetches this automatically on first sign-in. Note the `issuer` URL.

---

## 2. Register a client in your IdP

1. Create a new **OIDC client** (or "application") in your IdP.
2. Set the **redirect URI** to: `https://yourdomain.com/api/auth/oidc/callback/{provider-id}`
3. Set the **application type** to "Web" (confidential client).
4. Note the **client ID** and **client secret**.

Enable the following OAuth flows:

- Authorization Code (required)
- Refresh Token (optional; platform does not use it currently)

Ensure the `email` and `profile` scopes are granted and the ID token includes `email`, `email_verified`, and `name` claims.

---

## 3. Set environment variables

| Variable             | Description                              |
| -------------------- | ---------------------------------------- |
| `OIDC_ISSUER`        | OIDC issuer URL (from well-known config) |
| `OIDC_CLIENT_ID`     | Client ID from IdP                       |
| `OIDC_CLIENT_SECRET` | Client secret from IdP                   |
| `OIDC_TOKEN_SECRET`  | 32-byte HMAC secret for state tokens     |

---

## 4. Configure the adapter

```typescript
import { OidcIdentityProvider } from '@platform/adapter-identity-oidc';

const oidcProvider = new OidcIdentityProvider(
  {
    id: 'okta',
    displayName: 'Okta',
    issuer: process.env.OIDC_ISSUER,
    clientId: process.env.OIDC_CLIENT_ID,
    clientSecret: process.env.OIDC_CLIENT_SECRET,
    redirectUri: 'https://yourdomain.com/api/auth/oidc/callback/okta',
    tokenSecret: process.env.OIDC_TOKEN_SECRET,
    scopes: ['openid', 'email', 'profile'],
    justInTimeProvisioning: true,
    rpInitiatedLogout: true,
    // If your IdP uses non-standard claim names:
    claimMapping: {
      email: 'email', // default
      displayName: 'name', // default
    },
  },
  stateStore,
);
```

---

## 5. Attribute mapping

If your IdP uses non-standard claim names (e.g., `upn` for email), set `claimMapping`:

```typescript
claimMapping: {
  email: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/upn',
  displayName: 'http://schemas.microsoft.com/identity/claims/displayname',
}
```

Check the actual claim names by inspecting the ID token:

```bash
# Decode (not verify) the ID token to see claims
node -e "
  const token = 'eyJ...';
  const payload = Buffer.from(token.split('.')[1], 'base64url').toString();
  console.log(JSON.parse(payload));
"
```

---

## 6. Verify

1. Navigate to the platform sign-in page and click the IdP button.
2. Complete the IdP sign-in flow.
3. Confirm the callback URL is `https://yourdomain.com/api/auth/oidc/callback/{provider-id}`.
4. Verify the user was created in `identity_users`.

---

## Common issues

| Symptom                            | Cause                               | Fix                                                              |
| ---------------------------------- | ----------------------------------- | ---------------------------------------------------------------- |
| `OIDC state is invalid or expired` | State store lost the state record   | Check stateStore TTL (must be > browser latency)                 |
| `No ID token claims`               | IdP returned access token only      | Ensure `openid` scope is in the request                          |
| Email/name not populated           | IdP uses non-standard claim names   | Set `claimMapping` in config                                     |
| Discovery fails                    | Issuer URL wrong or IdP unreachable | Verify `{issuer}/.well-known/openid-configuration` is accessible |
