# identity-oidc

Generic OIDC adapter for any standards-compliant identity provider: Okta, Auth0, Keycloak, Google Workspace, Authelia, Authentik, custom OIDC servers.

Discovers IdP metadata automatically from `<issuerUrl>/.well-known/openid-configuration`. PKCE, state, and nonce are all required and enforced.

## Configuration

```env
IDENTITY_PROVIDER=oidc

OIDC_ISSUER_URL=https://identity.example.com
OIDC_CLIENT_ID=<your-client-id>
OIDC_CLIENT_SECRET=<from secret store>
OIDC_REDIRECT_URI=https://<your-domain>/auth/callback/oidc
OIDC_SCOPES=openid,profile,email

# Attribute mapping (IdP claim name → platform field)
OIDC_ATTR_EMAIL=email
OIDC_ATTR_DISPLAY_NAME=name
OIDC_ATTR_GROUPS=groups

# Optional: JIT provisioning
OIDC_JIT_PROVISIONING=true
```

## Capabilities

| Feature                   | Supported                                   |
| ------------------------- | ------------------------------------------- |
| oauth / oidc              | ✅ PKCE required                            |
| password / magic_link     | ❌ (IdP handles these)                      |
| mfa                       | ❌ (IdP handles MFA)                        |
| rp_initiated_logout       | ✅ when IdP supports `end_session_endpoint` |
| just_in_time_provisioning | ✅                                          |
| attribute_mapping         | ✅ configurable                             |
| group_sync                | ✅ if IdP includes groups claim             |

## Logout behavior

The adapter checks the IdP's discovery document for `end_session_endpoint`. When present, RP-initiated logout redirects the user to the IdP's logout endpoint. When absent, only the local session is revoked.

## Claim validation

The adapter validates:

- `iss` matches the configured issuer URL
- `aud` includes the configured client ID
- `exp` is in the future
- `nonce` matches the one stored in the state cookie
- `email_verified` is `true` (configurable — some IdPs don't include this claim)

## Common IdP-specific notes

**Okta**: Set `OIDC_ISSUER_URL` to your Okta authorization server URL (not just the Okta domain). Use the `okta.apps.manage` scope if you want group memberships.

**Auth0**: The issuer is `https://<your-tenant>.auth0.com/`. Groups come via a custom claim; configure `OIDC_ATTR_GROUPS` to match your Auth0 rule's claim name.

**Keycloak**: Issuer is `https://<host>/realms/<realm-name>`. Roles are available as `realm_access.roles` — configure attribute mapping accordingly.

## Runbook

`docs/runbooks/identity-provider-config-oidc.md` — setup, claim mapping, and troubleshooting.
