# ADR-0075: Compliance Documents as Living Artifacts

**Status:** Accepted
**Date:** 2026-05-02
**Deciders:** solo

## Context

Enterprise sales and enterprise security reviews require compliance documentation:

- SOC 2 auditors ask "how does your platform handle CC6.1?"
- Customer DPOs ask "what personal data do you store and on what legal basis?"
- HIPAA covered entities ask "where is PHI stored and how is it protected?"

The question is how to produce and maintain these documents. Options:

1. Write them once at a point in time and leave them static
2. Commission a compliance firm to produce them annually
3. Maintain them in the engineering team's workflow, updated as the platform changes

A further question: which parts can be auto-generated vs. must be manually authored?

The problem with static documents is that they rot. The platform evolves; the documents don't. When an auditor asks "what's your current configuration?" and the answer is "read this document written 2 years ago," the mismatch is a liability, not an asset.

## Decision

Compliance documents are **living artifacts maintained in the repository** — updated as the platform changes, reviewed on a defined schedule.

**Two categories:**

**Auto-generated (derived from code):**

- `docs/compliance/personal-data-registry.md` — generated from `packages/core/src/compliance/personal-data-registry.ts`. Every field's purpose, legal basis, and retention is in the code. The document is regenerated on every merge to main.
- `docs/compliance/audit-event-catalog.md` — generated from `packages/core/src/compliance/audit-events.ts`. Every event type with description and metadata.

Auto-generation ensures these documents can never lag behind the actual implementation. If a developer adds a new PII field or audit event type, the next CI run updates the document.

**Manually authored (cannot be meaningfully auto-generated):**

- `docs/compliance/control-matrix-soc2.md`
- `docs/compliance/control-matrix-gdpr.md`
- `docs/compliance/control-matrix-hipaa.md`
- `docs/compliance/threat-model.md`

These documents require human judgment to map platform features to regulatory requirements. They are reviewed:

- **Annually** (on a fixed date)
- **After architectural changes** that add new components, data flows, or trust boundaries
- **After security incidents** that reveal gaps

The review date and the next scheduled review are recorded at the top of each document.

**Ownership:** These documents are owned by the engineering team, not a separate compliance function. Compliance questions get answered by the people who built the thing. This is achievable because:

1. The platform is self-hosted; "compliance" is the platform's technical capabilities, not an audit of a service we operate
2. The engineering team is small enough that there is no ambiguity about who updates these documents

## Consequences

### Positive

- Documents are always current relative to the codebase; no stale-document risk.
- Auto-generated documents cannot drift from implementation.
- Enterprise customers get accurate, current documentation on demand (it's in the repo).
- Reviews are scheduled and documented; there's a clear process for auditors to understand.
- Changes to compliance-relevant behavior are visible in git history alongside the code that caused them.

### Negative

- The engineering team owns compliance documentation, which is not a natural responsibility for engineers. It requires discipline to keep documents updated when the platform changes.
- Auto-generation requires the generation pipeline to be maintained. If the pipeline breaks, documents stop updating.
- Manual documents can still drift if not reviewed; the annual review schedule is only as reliable as the team that follows it.

### Neutral

- Compliance documents in the repository are public (AGPL-3.0 codebase). This is deliberate: transparency about the platform's compliance posture is a feature, not a risk. The documents don't expose security vulnerabilities; they describe the controls the platform provides.
- "Auto-generated" means the CI pipeline runs a script on merge to main. The script serializes the TypeScript registry to markdown. No external tooling required.

## Alternatives Considered

### Option A: Annual compliance review by external firm

High quality; independent assessment. Rejected as too expensive and slow for a startup-phase product. More appropriate when the platform has paying enterprise customers whose audits depend on it.

### Option B: Static documents, updated on request

Minimal ongoing effort. Rejected because stale documents actively harm trust. An auditor who finds a document that doesn't match reality is more suspicious than one who finds no document. "We don't have this documented yet" is better than "we documented it wrong."

### Option C: Compliance platform integration (Vanta, Drata)

Would automate evidence collection and map to control frameworks. Attractive for larger teams. Rejected for now as overkill for the current scale; the platform exposes the APIs these tools need, so integration is a future path not a prerequisite.

## References

- [ADR-0071: Personal Data Registry as Code](./0071-personal-data-registry-as-code.md)
- `docs/compliance/` — all compliance documents
- `packages/core/src/compliance/personal-data-registry.ts`
- `packages/core/src/compliance/audit-events.ts`
