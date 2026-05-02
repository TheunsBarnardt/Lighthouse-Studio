# ADR-0002: Environment Strategy

**Status:** Accepted
**Date:** 2026-05-02
**Deciders:** solo

## Context

The platform needs a deployment strategy that is reproducible, self-hosted, and operable by a solo maintainer across three environments (dev, staging, prod). The reference deployment is on an Afrihost VPS in South Africa. The target customers include enterprises with strict data residency requirements, so the deployment must be fully self-hosted with no cloud-provider lock-in.

Key constraints:

- Single maintainer running the platform initially
- Server budget is a Afrihost VPS (8 GB RAM, 4 vCPU, 100 GB SSD)
- Must run on Linux now; Windows Server is a first-class future target
- No Vercel, no Supabase Cloud — those are the platform's _competitors_
- Strong environment isolation: a bug in dev cannot touch prod

## Decision

Three environments (dev, staging, prod) isolated as separate Docker Compose stacks on a single VPS, orchestrated by Coolify, with Caddy handling TLS and reverse proxy.

Branch-to-environment mapping:

- `develop` → dev (automatic, no approval)
- `staging` → staging (manual approval gate)
- `main` → prod (manual approval + 5-minute wait timer)

Only dev is active initially. Staging and prod stacks are designed and committed but dormant until buy-in lands.

## Consequences

### Positive

- Strong isolation: separate Docker networks, volumes, and secrets per environment
- Reproducible: Compose files are version-controlled; any environment can be rebuilt from git
- Low operational overhead: Coolify provides Vercel-like DX on the maintainer's own server
- Auto-SSL via Caddy/Let's Encrypt requires no manual certificate management
- The pattern scales to multiple servers (just add a second server + load balancer) without code changes

### Negative

- Single-server means no high availability for dev/staging initially
- Coolify adds an abstraction layer; debugging it requires understanding Coolify's internals
- Three separate Compose stacks on one server consume more memory than a single shared stack

### Neutral

- The dormant staging/prod stacks consume no resources until activated
- Promotion via merge (not tag) is a convention; teams used to tag-based deployment may need to adjust

## Alternatives Considered

### Option A: Vercel + Supabase Cloud

Pros: zero operational overhead; instant HTTPS; automatic preview deployments.
Cons: The platform itself is a Supabase competitor. Using Supabase Cloud for the reference deployment creates a marketing and trust problem. Vercel is locked to Vercel's infrastructure. Both violate the "self-hosted reference deployment" requirement.

### Option B: Kubernetes on a managed cluster

Pros: production-grade HA; horizontal scaling.
Cons: massively over-engineered for a solo maintainer with one VPS. K8s expertise is non-trivial to maintain. The cost jump from VPS to managed K8s is significant.

### Option C: Single Docker Compose stack with environment-specific config files

Pros: simpler; less memory overhead.
Cons: weaker isolation — a misconfigured volume mount can touch the wrong environment's data. Named stacks with distinct networks and volumes make cross-environment accidents impossible.

## References

- Objective 2: Environment Strategy
- ADR-0017: Self-Hosted Coolify as Orchestrator
