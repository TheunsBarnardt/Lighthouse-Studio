# identity-entra

Microsoft Entra ID (formerly Azure Active Directory) adapter. Uses OIDC under the hood via `openid-client`, with Entra-specific conveniences: tenant isolation, Microsoft Graph profile enrichment, and group-to-workspace membership sync.

## Configuration

```env
IDENTITY_PROVIDER=entra

ENTRA_TENANT_ID=<your-tenant-uuid>
ENTRA_CLIENT_ID=<application-uuid>
ENTRA_CLIENT_SECRET=<from secret store>
ENTRA_REDIRECT_URI=https://<your-domain>/auth/callback/entra

# Optional: Microsoft Graph group sync
ENTRA_GROUP_SYNC_ENABLED=false
ENTRA_GROUP_SYNC_WORKSPACE_MAP={"engineering-group-id":"engineering-workspace"}

# Optional: attribute mapping overrides (default maps standard OIDC claims)
ENTRA_ATTR_EMAIL=preferred_username
ENTRA_ATTR_DISPLAY_NAME=name
```

## Capabilities

| Feature                     | Supported                                  |
| --------------------------- | ------------------------------------------ |
| oauth / oidc                | ✅                                         |
| saml                        | ❌ (use identity-saml for SAML-only Entra) |
| mfa                         | ❌ (Entra owns MFA)                        |
| self_service_signup         | ✅ (Entra-controlled)                      |
| self_service_password_reset | ❌ (Entra owns passwords)                  |
| rp_initiated_logout         | ✅ back-channel logout                     |
| just_in_time_provisioning   | ✅                                         |
| attribute_mapping           | ✅ Microsoft Graph claims                  |
| group_sync                  | ✅ (opt-in)                                |

## Multi-tenant vs single-tenant

By default this adapter is configured for single-tenant (your organization only). For multi-tenant Entra apps, set `ENTRA_ALLOW_MULTITENANT=true` and validate the `tid` claim against an allowlist.

## Signing key rotation

`openid-client` automatically refreshes the Entra JWKS endpoint when keys rotate. No manual intervention needed. Keys are cached for 24 hours.

## Group sync

When enabled, the adapter calls Microsoft Graph `GET /me/memberOf` after each sign-in and syncs group memberships to platform workspace memberships according to `ENTRA_GROUP_SYNC_WORKSPACE_MAP`. Group sync failures are logged as warnings — they don't fail the sign-in.

## Runbook

`docs/runbooks/identity-provider-config-entra.md` — setup, app registration, group sync, and troubleshooting.
