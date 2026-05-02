# Runbook: SAML 2.0 Identity Provider Setup

Configure the platform as a SAML 2.0 Service Provider (SP) against an enterprise Identity Provider.

---

## 1. Generate SP certificates

```bash
# Generate a 2048-bit RSA key and self-signed certificate for the SP
openssl req -x509 -newkey rsa:2048 -keyout saml-sp.key -out saml-sp.crt \
  -days 3650 -nodes \
  -subj "/CN=platform-sp/O=Your Org/C=US"

# View the certificate (copy the content between -----BEGIN/END CERTIFICATE-----)
cat saml-sp.crt
```

Store the private key (`saml-sp.key`) in the secret store. Do not commit it to source control.

---

## 2. Obtain IdP metadata

From your IdP administrator, get:

- **IdP SSO URL** (HTTP-Redirect or HTTP-POST binding endpoint)
- **IdP signing certificate** (PEM format)
- **IdP entity ID** (issuer)

Many IdPs publish a metadata XML URL. Extract the above from:

```
https://idp.yourdomain.com/saml/metadata
```

---

## 3. Register the SP with the IdP

Provide the IdP administrator with:

- **SP entity ID**: `https://yourdomain.com` (or your chosen identifier)
- **ACS (Assertion Consumer Service) URL**: `https://yourdomain.com/api/auth/saml/callback/{provider-id}`
- **SP certificate**: content of `saml-sp.crt`
- **Name ID format**: `urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress` (recommended)

---

## 4. Set environment variables

| Variable               | Description                                     |
| ---------------------- | ----------------------------------------------- |
| `SAML_IDP_ENTRY_POINT` | IdP SSO URL                                     |
| `SAML_IDP_CERT`        | IdP signing certificate (PEM, no headers)       |
| `SAML_SP_PRIVATE_KEY`  | SP private key (PEM, for signing AuthnRequests) |

---

## 5. Configure the adapter

```typescript
import { SamlIdentityProvider } from '@platform/adapter-identity-saml';

const samlProvider = new SamlIdentityProvider({
  id: 'adfs',
  displayName: 'Corporate SSO',
  entityId: 'https://yourdomain.com',
  callbackUrl: 'https://yourdomain.com/api/auth/saml/callback/adfs',
  privateKey: process.env.SAML_SP_PRIVATE_KEY,
  entryPoint: process.env.SAML_IDP_ENTRY_POINT,
  idpCert: process.env.SAML_IDP_CERT,
  attributeMapping: {
    email: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
    displayName: 'http://schemas.microsoft.com/identity/claims/displayname',
  },
  justInTimeProvisioning: true,
});
```

---

## 6. Test the flow

```bash
# Initiate SAML flow (returns a redirect URL)
curl -s https://yourdomain.com/api/auth/saml/begin/adfs | jq '.url'
```

Open the URL in a browser and complete the IdP sign-in. The IdP will POST the SAMLResponse to the ACS URL.

---

## 7. Signing certificate rotation

SP certificate rotation (run 30 days before expiry):

1. Generate a new SP certificate (step 1 above).
2. Configure the adapter with both the old and new certificates (if the IdP supports multiple SP certs; otherwise coordinate a cutover window).
3. Update the SP metadata registered with the IdP.
4. Deploy and verify sign-in works with the new certificate.
5. Remove the old certificate from the IdP configuration.

IdP certificate rotation:

1. Obtain the new IdP certificate from the IdP administrator.
2. Update `SAML_IDP_CERT` in the deployment.
3. Restart the application. The adapter reads the cert at startup.

---

## Common issues

| Symptom                            | Cause                                      | Fix                                                       |
| ---------------------------------- | ------------------------------------------ | --------------------------------------------------------- |
| `Invalid signature`                | IdP cert does not match the one configured | Update `idpCert` with the correct cert                    |
| `SAMLResponse is not valid base64` | ACS URL receiving GET instead of POST      | Verify IdP is configured for HTTP-POST ACS                |
| Email not extracted                | Wrong attribute name                       | Inspect raw SAMLResponse; update `attributeMapping.email` |
| `SAML response was a logout`       | IdP sent SLO response instead of assertion | Platform does not initiate SLO; check IdP config          |
