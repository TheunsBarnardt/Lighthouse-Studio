# ADR-0087: Windows Integrated Authentication via IIS Headers

**Status:** Accepted
**Date:** 2026-05-03
**Deciders:** solo

## Context

Microsoft-house customers with on-premises Active Directory often want employees to sign into the platform using their Windows domain credentials via Kerberos/NTLM (Windows Integrated Authentication, WIA). This is a seamless SSO experience: users open the platform in their browser and are authenticated automatically without entering a password.

The platform already supports Entra ID via `identity-entra` (Objective 5). For on-premises AD customers who haven't moved to Entra, or who want Kerberos-based authentication alongside Entra, an additional identity adapter is needed.

IIS can perform the Kerberos/NTLM handshake natively (via the Windows Authentication feature). Once IIS authenticates the user, it forwards the authenticated principal's identity to the Node app via request headers. The Node app trusts these headers and derives its `VerifiedIdentity` from them.

This is a header-trust security pattern. Security depends entirely on IIS being the only ingress path to the Node app; if the Node app is accessible by any other route, an attacker can inject the headers directly.

## Decision

Implement the **`identity-windows-integrated`** adapter that:

1. Reads the authenticated user identity from IIS-injected headers (`LOGON_USER`, `HTTP_X_FORWARDED_USER`, or `AUTH_USER` — configurable).
2. Translates the domain account (e.g., `DOMAIN\jsmith`) into the platform's `VerifiedIdentity` shape.
3. Declares capability `windows_integrated_auth: true` when active.
4. Enforces via configuration that the adapter only activates when a trusted-proxy lock flag is set (preventing accidental exposure without proper IIS-only routing).

The adapter must be configured with the list of trusted upstream IP addresses (IIS server addresses). Requests not from those IPs are rejected with a `401 Unauthenticated` response even if the header is present, providing a defence-in-depth layer.

The security model is documented in the adapter's `CLAUDE.md` and the deployment guide. The ops team is responsible for ensuring no path bypasses IIS.

## Consequences

### Positive

- Enables true Kerberos SSO for on-premises AD customers without requiring Entra ID.
- Minimal overhead: header parsing is O(1); no external identity provider call per request.
- Allows the platform to appear seamlessly in the browser without a login prompt for domain-joined machines.
- No additional dependency on an LDAP library or AD SDK.

### Negative

- Security is predicated on network topology: IIS must be the only path to the Node port. A misconfigured firewall rule that exposes `:3000` directly is a critical security vulnerability.
- MFA is not enforced at the application layer; AD/Group Policy must enforce it upstream (documented requirement).
- Header names differ by IIS version and configuration; the adapter is configurable but requires ops validation.
- Not usable in environments where the Node app is not behind IIS (e.g., local development, Linux deployments).

### Neutral

- The existing `identity-entra` adapter remains the recommended path for customers on Entra ID. `identity-windows-integrated` is for on-premises-only or hybrid deployments where Entra isn't available.
- Conformance tests run with a mock that injects headers as IIS would; they test the adapter logic, not the IIS handshake.

## Alternatives Considered

### Option A: Direct LDAP/Active Directory SDK

Implement an `identity-ldap` adapter using `ldapjs` or `activedirectory2` to bind to AD directly.

**Rejected for this objective:** LDAP bind requires service account credentials and network access to AD domain controllers. It's significantly more complex than header trust, requires the platform to handle LDAP protocol details, and is a security surface in itself. An `identity-ldap` adapter can be added later as a paid adapter for customers who need it. The header-trust approach handles 80% of the WIA use case with 20% of the complexity.

### Option B: ADFS with OIDC

The customer deploys Active Directory Federation Services (ADFS) as an OIDC provider, and the platform uses `identity-oidc`.

**Accepted as the preferred upgrade path:** Customers who can deploy ADFS should use `identity-oidc` against ADFS — it's a more maintainable solution. `identity-windows-integrated` is for customers who cannot deploy ADFS (typically smaller environments or IT departments that don't have ADFS expertise).

### Option C: Passport.js with Windows Auth strategy

Use a Node.js authentication middleware library that implements the NTLM/Kerberos handshake directly in Node.

**Rejected:** The Node NTLM implementations are not production-quality. IIS's native Windows Authentication is battle-tested and integrates with the OS's credential store. Reimplementing it in Node creates a fragile, non-standard solution that IT teams won't trust.

## References

- Objective 09: Cross-Platform Runtime (§5.4, §6.2)
- ADR-0084: Windows Server as First-Class Deployment Target
- [IIS Windows Authentication](https://learn.microsoft.com/en-us/iis/configuration/system.webserver/security/authentication/windowsauthentication/)
