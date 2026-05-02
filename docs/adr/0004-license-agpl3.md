# ADR-0004: License Choice (AGPL-3.0)

**Status:** Accepted
**Date:** 2026-05-02
**Deciders:** solo

## Context

The platform is open-source. The license choice determines:

- Who can use the platform and under what conditions
- Whether SaaS providers can offer the platform as a managed service without contributing back
- Whether commercial customers need a separate commercial license
- The platform's competitive positioning relative to Supabase (AGPL), PocketBase (MIT), and others

The platform's business model includes a dual-license option: AGPL for the open-source community, commercial license for enterprise customers who cannot accept the AGPL's copyleft terms.

The license file at `LICENSE` and `NOTICE` are already committed.

## Decision

AGPL-3.0 (GNU Affero General Public License, version 3) as the primary open-source license.

Key implications:

- Anyone who modifies and deploys the platform must release their modifications under AGPL
- SaaS providers using the platform must release their modifications (the "network use" clause)
- Enterprise customers who cannot accept the AGPL terms can purchase a commercial license
- The CLA (`CLA.md`) requires contributors to assign dual-licensing rights to the maintainer

## Consequences

### Positive

- Prevents SaaS companies from turning the platform into a closed managed service without contributing back
- Consistent with Supabase's license — customers and contributors are familiar with the model
- The CLA enables a dual-licensing commercial model without re-licensing negotiations
- "OSS tax" on competitors: anyone building on top must contribute or pay

### Negative

- AGPL is restrictive for some enterprise buyers — some legal teams have blanket bans on AGPL
- Dual-licensing requires a working CLA process (which is documented in `CLA.md`)
- The "network use" clause can be interpreted broadly; some use cases fall in grey areas

### Neutral

- The CLA does not affect most contributors (casual contributors, bug fixers)
- Existing ADR-0013 (CLA and dual-licensing) covers the CLA specifics

## Alternatives Considered

### Option A: MIT

Pros: Maximum adoption; no contributor friction.
Cons: Allows any company, including direct competitors, to take the platform, close-source it, and sell it as a managed service. Inconsistent with the platform's "self-hosted first" positioning.

### Option B: BSL (Business Source License)

Pros: Time-limited protection; becomes open-source after 4 years.
Cons: Not OSI-approved; some communities avoid it. HashiCorp's BSL switch was highly controversial.

### Option C: Apache 2.0

Pros: OSI-approved; patent protections; widely accepted by enterprises.
Cons: Does not prevent SaaS competitors from taking the platform. Too permissive for the business model.

### Option D: GPL-2.0 (without the "or later" clause)

Pros: Copyleft protection; widely understood.
Cons: No network-use clause — a SaaS provider running GPL code doesn't have to release their modifications if they don't distribute the binary.

## References

- `LICENSE` — AGPL-3.0 full text
- `CLA.md` — Contributor License Agreement
- `NOTICE` — Attribution notices
- ADR-0013: CLA and Dual-Licensing Strategy
