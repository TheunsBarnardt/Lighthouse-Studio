# ADR-0255: First-Party Deployment Orchestrator

**Status:** Proposed (supersedes [ADR-0017](0017-coolify-as-orchestrator.md))
**Date:** 2026-05-07
**Deciders:** solo

## Context

ADR-0017 selected Coolify as the deployment orchestrator. Re-evaluation surfaced three problems that compound:

1. **Audit-boundary leakage.** Coolify performs build/deploy actions outside the platform's audit vocabulary (Objective 7). The platform cannot honestly claim "every state-changing action is audited" while a third party manages container lifecycle.
2. **External runtime dependency.** A platform marketed as self-hosted and air-gappable should not require a separate self-hosted PaaS to run. "Install Lighthouse + install Coolify + wire them together" is a worse experience than "install Lighthouse on a VPS with Docker."
3. **RBAC + secret integration friction.** Coolify has its own user model and its own env-var store. Bridging Objective 6's RBAC and the `SecretStorePort` (Objective 2) into Coolify is a permanent integration tax.

The capabilities Coolify provided (Compose runtime, Caddy auto-SSL, env-var management, web UI for visibility) are well-defined and already half-implemented elsewhere in the platform.

## Decision

Build a first-party deployment orchestrator as `apps/deploy-orchestrator/`, owned by Objective 29. Two deploy modes share a single orchestrator core; mode is a per-app, per-environment choice.

### Common surface (both modes)

| Concern      | Implementation                                                                                                                     |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Build        | BuildKit (container mode) **or** `pnpm build` + signed tarball (native mode); CycloneDX SBOM emitted in both                       |
| Target hosts | Workspace registers hosts per environment; transport is SSH (Linux) or WinRM (Windows); single-host or multi-host fleets supported |
| Rollout      | Rolling default; blue/green opt-in; both supported in both modes                                                                   |
| Rollback     | Prior artifact + config retained per Obj 29 (default 7 days)                                                                       |
| Logs         | Streamed from target host via the existing event bus to the deploy UI                                                              |
| Secrets      | Injected from `SecretStorePort` at render time; redacted in streamed logs                                                          |
| CVE gate     | `VulnerabilityScannerPort` (ADR-0254) invoked before promotion in both modes                                                       |
| Audit        | `deploy.build.*`, `deploy.scan.*`, `deploy.rollout.*`, `deploy.rollback.*`, `deploy.host.*`                                        |

### Container mode (Docker available on target)

| Concern          | Implementation                                                                        |
| ---------------- | ------------------------------------------------------------------------------------- |
| Build artifact   | OCI image; pushed to local `registry:2` (or pluggable remote)                         |
| Runtime          | Docker Compose v2; one project per app+environment                                    |
| Edge proxy / TLS | Embedded Caddy with on-demand Let's Encrypt; Caddyfile generated from the deploy plan |

### Native mode (no Docker required on target)

| Concern        | Implementation                                                                                                                  |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Build artifact | Signed Node.js tarball (bundle + manifest + SBOM); reproducible                                                                 |
| Linux target   | systemd unit installed; Caddy reverse proxy on the target (or upstream from a platform-side Caddy where the target is internal) |
| Windows target | `node-windows` service installed; IIS site + Application Request Routing reverse proxy                                          |
| TLS            | Let's Encrypt where the target can reach ACME; customer-supplied cert path otherwise (air-gapped)                               |
| Egress         | Native mode works on hosts with **no internet egress** — pre-staged tarballs and certs                                          |

**Out of scope for v1**: full clustering / scheduler / HA (k8s-class), canary / traffic-percentage routing, customer-managed control planes (the orchestrator runs on the platform host, even when target hosts are customer-owned).

## Consequences

### Positive

- Single audit/security boundary. Every deploy action emits `deploy.*` events into Objective 7's hash-chained log.
- Native integration with `SecretStorePort` and workspace RBAC — no bridge to maintain.
- Air-gapped story is straightforward: the platform itself is the orchestrator.
- The platform's "no third-party runtime dependency" posture becomes true in practice, not just on paper.

### Negative

- Re-implements capabilities Coolify already provides. The build cost is real. Mitigated by: (a) Caddy and Docker handle the hard parts; (b) the orchestrator's surface is intentionally narrow (single VPS, Compose only) to keep scope bounded.
- Single-VPS limitation is now the platform's responsibility, not Coolify's. Multi-host clustering is a future objective if needed.

### Neutral

- The Caddy reverse proxy continues to do what Coolify wrapped Caddy for; the platform now owns the Caddyfile generation directly.
- Existing `infra/caddy/Caddyfile.platform` content moves into the orchestrator's renderer.

## Alternatives Considered

### Option A: Stay on Coolify (status quo)

Pros: less work; mature codebase.
Cons: see Context above. The integration tax compounds.

### Option B: Adopt a different self-hosted PaaS (Dokploy, CapRover, Dokku)

Pros: similar capability profile.
Cons: same three problems with Coolify, just a different vendor. Trading one external runtime dep for another.

### Option C: Kubernetes (k3s or full)

Pros: industry-standard; horizontal scale.
Cons: massive scope expansion. Customer-managed K8s clusters are the right v2 target, but v1's single-VPS posture is well-served by Compose.

### Option D: Raw scripts / Ansible

Pros: minimal abstraction.
Cons: gives up the orchestrator UX (deploy UI, streaming logs, single-click rollback) that customers expect.

## References

- ADR-0017 (now superseded)
- ADR-0254 (CVE scan gate — runs inside the orchestrator)
- Objective 29 (Stage 9 — Deployment)
- Objective 9 (Cross-Platform Runtime — Linux and Windows both first-class customer-app targets)
- Objective 2 (Environment Strategy) — `SecretStorePort` integration
- Objective 7 (Audit & Compliance) — `deploy.*` audit vocabulary
