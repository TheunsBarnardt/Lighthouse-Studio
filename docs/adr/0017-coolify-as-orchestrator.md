# ADR-0017: Self-Hosted Coolify as Deployment Orchestrator

**Status:** Superseded by [ADR-0255](0255-first-party-deployment-orchestrator.md) (2026-05-07)
**Date:** 2026-05-02
**Deciders:** solo

> **Superseded.** The platform now ships a first-party deployment orchestrator
> rather than depending on Coolify at runtime. The rationale and decision
> below are preserved for historical context. New work follows ADR-0255.

## Context

The platform needs a deployment orchestrator that:

- Runs on the maintainer's single VPS (not a managed cloud)
- Handles deploys triggered by GitHub Actions webhooks
- Manages environment variables per stack (with secret masking)
- Provides Caddy-based auto-SSL for subdomains
- Has a web UI for visibility and manual intervention
- Works with Docker Compose (not Kubernetes)
- Has a reasonable operational burden for a solo maintainer

The alternatives range from raw Docker Compose + shell scripts (maximum control, maximum work) to Kubernetes (maximum capability, maximum complexity).

## Decision

**Coolify** (self-hosted PaaS, open-source, Docker-based).

Coolify runs as a Docker stack on the VPS. It:

- Reads the GitHub repository and triggers builds/deploys via webhook
- Manages environment variables per project/environment (sensitive vars are write-only)
- Provides a Caddy reverse proxy with auto-SSL (Let's Encrypt)
- Has a web UI accessible at `coolify.<domain>` (IP-restricted)
- Supports Docker Compose stack deployments

The platform CI (GitHub Actions) triggers Coolify deploys via webhook rather than using Coolify's built-in auto-deploy. This keeps the deploy logic in CI (where it can be reviewed, gated, and audited) rather than relying on Coolify's own triggers.

## Consequences

### Positive

- Provides Vercel-like DX (deploy from git, preview URLs, env var management) on the maintainer's own server
- Caddy is bundled with Coolify — SSL certificates require zero manual work
- Coolify's community is active; it's well-maintained
- Separating deploy triggers to CI (not Coolify auto-deploy) means the deploy pipeline is auditable and can be gated
- Switching away from Coolify in the future requires only changing how Compose stacks are started — the app code and Compose files don't change

### Negative

- Coolify is an additional abstraction layer; debugging it occasionally requires understanding Coolify's Docker internals
- Coolify itself must be kept up to date (security patches)
- If Coolify has a bug, it can affect all three environment stacks
- Coolify's admin UI must be IP-restricted manually (it doesn't ship with IP restriction out of the box)

### Neutral

- Coolify uses Caddy under the hood; the `infra/caddy/Caddyfile.platform` override file customises the routing
- Coolify stores environment variables in its own database; they're backed up as part of the server backup

## Alternatives Considered

### Option A: Raw Docker Compose + shell scripts

Pros: Maximum control; no abstraction layer; easy to understand.
Cons: No web UI; environment variable management is manual; SSL certificates require manual certbot setup; significantly more operational work.

### Option B: Kubernetes (managed or self-hosted)

Pros: Production-grade; supports HA; horizontal scaling.
Cons: Massively over-engineered for a single-server single-maintainer deployment. Learning curve is significant. A solo maintainer managing a K8s cluster is a liability, not an asset.

### Option C: Caprover

Pros: Similar to Coolify; open-source.
Cons: Less actively maintained than Coolify at the time of this decision. Smaller community.

### Option D: Dokku

Pros: Heroku-like; well-established; minimal overhead.
Cons: Heroku-push model (git push to deploy) is less CI-friendly than webhook-triggered deploys. Less suited to Docker Compose multi-service deployments.

## References

- Objective 2: Environment Strategy (Section 5.2)
- ADR-0002: Environment Strategy
- `infra/caddy/Caddyfile.platform`
