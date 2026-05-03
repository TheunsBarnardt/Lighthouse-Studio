# ADR-0085: IIS as Reverse Proxy via Application Request Routing

**Status:** Accepted
**Date:** 2026-05-03
**Deciders:** solo

## Context

The platform's web app is a Node.js process. On Windows Server, something must sit in front of it to:

1. Terminate TLS (certificate management is a Windows/IIS concern)
2. Serve the public HTTPS endpoint
3. Forward requests to the Node process on `localhost:3000`
4. Add forwarding headers (`X-Forwarded-For`, `X-Forwarded-Proto`)
5. Optionally handle WAF rules if the customer has an existing WAF

Windows Server's built-in web server is IIS. Microsoft-house customers already have IIS installed, managed, and monitored. The question is how to get IIS to forward requests to Node rather than serve static files directly.

Two main options exist: `iisnode` (a native IIS module that runs Node inside IIS's worker process) and IIS as a traditional reverse proxy using Application Request Routing (ARR) + URL Rewrite.

## Decision

Use **IIS as a reverse proxy via ARR and URL Rewrite**. The Node process runs independently as a Windows Service (via `node-windows`); IIS proxies requests to it on `localhost:3000`.

The configuration is a `web.config` template in `deploy/iis/web.config.template`, generated via `deploy/iis/web.config.generate.mts` at deploy time. ARR and URL Rewrite are installed by the PowerShell script `deploy/iis/setup-iis-arr.ps1`.

TLS terminates at IIS. The Node app sees plain HTTP on `localhost:3000`. `X-Forwarded-For` and `X-Forwarded-Proto: https` headers are injected by IIS before forwarding.

The `web.config` is deployed to the IIS site root. The Node process is managed entirely separately (Windows Service with auto-restart, separate logging). IIS failure doesn't kill the Node process and vice versa.

## Consequences

### Positive

- Aligns with what Microsoft-house IT departments know. No unusual tooling to justify.
- TLS certificate management stays in IIS (where they already manage certificates).
- ARR is actively maintained by Microsoft; it works with IIS 10 on Windows Server 2019/2022.
- Node process lifecycle is decoupled from IIS; a crashed Node service doesn't take IIS down.
- Node process can be restarted independently without touching IIS configuration.
- WAF integration: customers can front IIS with an existing WAF appliance without changes.
- URL Rewrite handles all traffic forwarding; custom headers are trivially added.

### Negative

- ARR must be installed (requires IIS Module installer); the setup script handles this but it is one extra step.
- If IIS stops, the platform goes down even though the Node process may be healthy. Monitoring must cover both.
- `X-Forwarded-For` trust configuration must be set correctly in the Node app; misconfigured, it can expose real IPs or be spoofed.

### Neutral

- `iisnode` (alternative, see below) is still documented as an option for customers already using it.
- The `web.config` pattern is familiar to .NET shops; a Windows engineer can maintain it without learning Node tooling.

## Alternatives Considered

### Option A: iisnode

`iisnode` is an IIS module that hosts the Node.js runtime inside IIS's worker process (W3WP.exe). IIS serves the Node app natively; no separate reverse proxy needed.

**Rejected:** `iisnode` is not actively maintained (last significant release in 2020). It requires a specific Node version to be installed alongside the IIS module, and version upgrades are risky. It also couples the Node process lifecycle to IIS worker recycling, which can cause unexpected restart behaviour. The platform would become dependent on a stale third-party IIS module, which is a long-term maintenance risk.

### Option B: nginx for Windows

nginx has a Windows build. It could serve as the reverse proxy instead of IIS.

**Rejected:** Microsoft-house customers don't have nginx expertise and don't want to manage a non-standard service. nginx on Windows is also not officially supported by nginx Inc. — the Windows build is a secondary port. Adding nginx to a Windows deployment story creates more friction than it removes.

### Option C: Expose Node directly on port 443

Terminate TLS in Node via a `https.createServer` with a certificate loaded from disk. No IIS needed.

**Rejected:** Certificate management in Microsoft environments is handled through IIS, Active Directory Certificate Services, or Let's Encrypt via `win-acme`. Customers don't want to manage PFX files in Node configuration. Furthermore, binding port 443 in Windows requires elevated privileges or an explicit `netsh` rule; IIS already holds that port and manages the binding cleanly.

## References

- Objective 09: Cross-Platform Runtime (§5.3)
- ADR-0084: Windows Server as First-Class Deployment Target
- ADR-0086: node-windows for Service Hosting
- [Microsoft ARR documentation](https://learn.microsoft.com/en-us/iis/extensions/planning-for-arr)
- [URL Rewrite module](https://www.iis.net/downloads/microsoft/url-rewrite)
