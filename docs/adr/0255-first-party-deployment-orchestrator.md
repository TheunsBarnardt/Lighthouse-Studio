# ADR-0255: First-Party Deployment Orchestrator (Supersedes ADR-0017)

**Status:** Accepted  
**Date:** 2026-05-07  
**Objective:** 29 (Deployment)

## Context

ADR-0017 (if it exists) considered third-party PaaS tools (Coolify, Dokploy, CapRover) as potential deployment targets. We must decide whether to use a third-party orchestrator or build first-party.

## Decision

The platform uses a **first-party deployment orchestrator** (`apps/deploy-orchestrator/`) that implements `DeploymentPort`. No external PaaS is used at runtime.

The orchestrator supports:
- **Container mode**: Docker Compose v2 with a local OCI registry; Caddy edge proxy with TLS
- **Native mode**: systemd on Linux; node-windows + IIS on Windows — no Docker required on target
- Multi-host fleets via SSH (Linux) and WinRM (Windows)
- SBOM (CycloneDX) emitted in both modes

This supersedes any prior consideration of external PaaS tools.

## Consequences

- Platform owns the full deployment path; no external service dependency
- Platform must maintain orchestrator code for both container and native modes
- Customers without Docker (regulated, bare-metal) are first-class citizens
- `apps/deploy-orchestrator/` is a new package in the monorepo

## Alternatives Considered

- **Coolify/Dokploy/CapRover**: external runtime dependency; breaks air-gapped installs; single security/audit boundary required; rejected
- **Kubernetes**: heavyweight; not installed by default on bare-metal or legacy Windows; deferred to v2

## Supersedes

ADR-0017 (external PaaS consideration) — marked Superseded.
