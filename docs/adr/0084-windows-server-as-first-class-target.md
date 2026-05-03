# ADR-0084: Windows Server as a First-Class Deployment Target

**Status:** Accepted
**Date:** 2026-05-03
**Deciders:** solo

## Context

The platform's multi-database thesis (PostgreSQL, MSSQL, MongoDB) targets enterprise customers who frequently run Microsoft-centric infrastructure. For these "Microsoft-house" customers, a Linux-only deployment story is a blocker: their IT departments manage Windows Server 2019/2022, approve software via Microsoft's standard tooling, and require integration with Active Directory, Entra ID, and Azure Key Vault.

Without native Windows Server support the platform's claim of "runs anywhere" is only half-true. The MSSQL and identity-entra adapters (Objectives 4a, 5) provide the database and identity layers, but they're useless if the Node process itself can't be installed and managed in a Windows Server environment.

Previous objectives have applied cross-platform discipline (no bash-isms, `path` module for paths, `tsx` scripts instead of shell scripts) but this has never been tested on a real Windows Server. The discipline might have gaps.

## Decision

Windows Server 2019 and 2022 are first-class deployment targets, on par with Linux. This means:

1. The platform must build, test, and run on Windows Server 2019+ without modification to the application code.
2. A customer-facing deployment guide covers the Windows path end-to-end.
3. CI has a Windows runner that verifies the platform on every PR (focused subset) and nightly (full suite).
4. All operational runbooks cover both Linux and Windows where behaviour differs.
5. The four Microsoft-specific adapters (`identity-windows-integrated`, `secret-azure-keyvault`, `storage-azure-blob`, `email-graph`) are shipped with the platform.

The minimum supported Windows Server version is **2019**. Windows Server 2016 is explicitly out of scope (mainstream support ends 2022; extended support ends 2027; its absence of modern features is not worth the maintenance burden). Windows Server Containers (process isolation) are deferred to a later objective.

macOS is a supported developer machine but not a supported production deployment target. WSL ("Linux on Windows") is explicitly out of scope as a deployment mode; we support native Windows or nothing.

## Consequences

### Positive

- Unblocks sale to any Microsoft-house customer.
- Validates that prior cross-platform discipline was applied correctly.
- CI Windows runner catches Windows-specific regressions before they reach customers.
- Microsoft-specific adapters (Key Vault, Graph, Windows Auth) become available for the adapter ecosystem.

### Negative

- CI cost increases (Windows runners are slower and more expensive than Linux).
- Maintenance overhead: new features must be verified on Windows or risk regressions.
- Four new adapter packages add surface area to the adapter ecosystem.
- Deployment guide and runbooks must be kept in sync with application changes.

### Neutral

- Node.js 22 LTS is available on Windows from the official Microsoft-signed MSI, so no custom distribution is needed.
- The MSSQL adapter (Objective 4a) already handles the database layer; this objective adds the process management and IIS layers.

## Alternatives Considered

### Option A: WSL (Windows Subsystem for Linux)

Customers install WSL2 on the Windows Server and deploy as if on Linux. Simple from a development standpoint.

Rejected: Most enterprise IT departments do not approve WSL on production servers. It also defeats the purpose — the customer already has Windows Server and wants a native Windows artifact they can manage with standard Windows tools.

### Option B: Windows Containers

Package the application in a Windows Docker container. Closer to native than WSL; manageable via Azure Container Registry.

Rejected for this objective: Windows containers have much larger base images (5–10 GB vs. ~200 MB), require Hyper-V or process isolation mode, and are uncommon in traditional Windows Server shops. Deferred to a later objective for customers who want a container story on Windows.

### Option C: Azure App Service (PaaS)

Deploy to Azure App Service (Windows or Linux nodes) and remove the self-hosted deployment concern entirely.

Rejected: The platform is self-hosted by design. Forcing Azure PaaS would make on-premise Microsoft deployment (common in finance, government, and healthcare) impossible.

## References

- Objective 09: Cross-Platform Runtime
- ADR-0085: IIS as Reverse Proxy via ARR
- ADR-0086: node-windows for Service Hosting
- [Node.js official Windows installer](https://nodejs.org/en/download)
