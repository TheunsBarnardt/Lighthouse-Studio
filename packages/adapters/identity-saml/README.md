# identity-saml

SAML 2.0 Service Provider adapter for older enterprise identity providers: ADFS, on-premises Active Directory with SAML, Shibboleth, PingFederate, and similar.

Implements the SP role. Supports both SP-Initiated and IdP-Initiated flows. Signed AuthnRequests and signed/encrypted assertions.

## Configuration

```env
IDENTITY_PROVIDER=saml

# IdP metadata — URL preferred (auto-refreshes); paste XML as fallback
SAML_IDP_METADATA_URL=https://idp.example.com/FederationMetadata/2007-06/FederationMetadata.xml
# SAML_IDP_METADATA_XML=<base64-encoded metadata XML>  # alternative if URL not available

# SP identity
SAML_SP_ENTITY_ID=https://<your-platform-domain>
SAML_ACS_URL=https://<your-platform-domain>/auth/callback/saml

# SP signing (the platform signs AuthnRequests and decrypts assertions)
SAML_SIGNING_CERT=<base64-encoded PEM certificate>
SAML_SIGNING_KEY=<from secret store — base64-encoded PEM private key>

# Attribute mapping
SAML_ATTR_EMAIL=http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress
SAML_ATTR_DISPLAY_NAME=http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name
SAML_ATTR_GROUPS=http://schemas.xmlsoap.org/claims/Group

# Optional: JIT provisioning
SAML_JIT_PROVISIONING=true
```

## Capabilities

| Feature                   | Supported                                   |
| ------------------------- | ------------------------------------------- |
| saml                      | ✅ signed assertions required               |
| oauth / oidc              | ❌ (use identity-oidc for those)            |
| mfa                       | ❌ (IdP handles MFA)                        |
| rp_initiated_logout       | ✅ Single Logout (SLO) when IdP supports it |
| just_in_time_provisioning | ✅                                          |
| attribute_mapping         | ✅ via SAML attribute statements            |
| group_sync                | ✅ if IdP includes group attributes         |

## Security requirements

- **Signed assertions required**: the adapter rejects unsigned assertions. Configure the IdP to sign all assertions with its SAML signing certificate.
- **Encrypted assertions supported**: if the IdP encrypts assertions, provide the platform's decryption key via `SAML_SIGNING_KEY`.
- **AuthnRequests signed**: the adapter signs all SP-initiated AuthnRequests. Verify the SP certificate is registered in the IdP.
- **Audience restriction validated**: the `<Audience>` element in the assertion must match `SAML_SP_ENTITY_ID`.

## Single Logout (SLO)

When the IdP's metadata includes a `SingleLogoutService` endpoint, sign-out redirects the user to the IdP's SLO endpoint. Both SP-initiated and IdP-initiated logout are handled.

## Certificate rotation

1. Generate a new SP signing certificate and key.
2. Add the new certificate to the IdP's trusted SP configuration alongside the old one.
3. Update `SAML_SIGNING_CERT` and `SAML_SIGNING_KEY` to the new values.
4. Wait until all sessions signed with the old cert have expired.
5. Remove the old cert from the IdP.

See `docs/runbooks/identity-key-rotation.md` for the full procedure.

## Runbook

`docs/runbooks/identity-provider-config-saml.md` — IdP setup, SP metadata export, attribute mapping, and troubleshooting.
