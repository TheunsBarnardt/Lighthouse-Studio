# ADR-0201: Curated Integration Catalog (Not Arbitrary npm)

**Status:** Accepted
**Date:** 2026-05-07
**Objective:** 27 — Code Generation

## Context

Generated functions need to call third-party APIs (Stripe, SendGrid, etc.). They could import arbitrary npm packages or use a curated, platform-audited catalog.

## Decision

Generated functions use a curated integration catalog — pre-built, audited TypeScript adapters shipping with the platform. Adapters are imported from `@platform/integrations/<id>`. The initial catalog: Stripe, SendGrid, Postmark, Twilio, OAuth providers, outbound webhooks, Slack, S3-compatible storage. Adding new integrations is a platform-team action after security review.

For integrations not in the catalog, a generic HTTPS helper is available as a fallback.

## Consequences

- Integration adapters are audited, versioned, and consistently tested
- Customers cannot introduce arbitrary supply-chain risk via npm packages
- New integrations require platform-team involvement — this is intentional

## Alternatives considered

- **Arbitrary npm imports** — supply-chain risk; no security guarantees; harder to audit; deferred post-v1
