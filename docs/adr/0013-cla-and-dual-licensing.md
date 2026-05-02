# ADR-0013: CLA and Dual-Licensing Reservation

**Status:** Accepted
**Date:** 2026-05-02
**Deciders:** solo (Theuns Barnardt)

## Context

The platform is licensed AGPL-3.0. A future commercial licensing path (for customers who cannot use AGPL, such as enterprises distributing proprietary software) requires that the license owner hold all copyright or have a Contributor License Agreement (CLA) granting them relicensing rights. Without a CLA, a single outside contribution without that grant permanently forecloses dual-licensing for those lines of code.

## Decision

Every contributor (including the initial author) must sign a CLA before code is merged. The CLA grants the project owner:

1. The right to use the contribution under AGPL-3.0.
2. The right to relicense the contribution under other terms (the dual-licensing reservation).
3. The contributor warrants that they have the right to make the contribution.

The CLA document is committed at `.github/CLA.md`. CLA Assistant is configured on the repository to enforce signing on every PR. PRs without a signed CLA are blocked from merging.

For solo development, the infrastructure exists but enforcement is trivial (the author signs once). The moment the first outside contributor submits a PR, enforcement is automatic.

**Note:** The CLA text and its licensing implications should be reviewed by an open-source-aware lawyer before soliciting significant outside contributions.

## Consequences

### Positive

- Dual-licensing optionality is preserved indefinitely as long as all contributions carry the CLA.
- Future commercial licensing is possible without auditing or re-contacting contributors.
- CLA Assistant automates the friction — no manual tracking.

### Negative

- Some potential contributors refuse to sign CLAs on principle (Apache ICLA is standard, but some reject any CLA). This may reduce contribution volume.
- Setup requires a GitHub App installation and initial configuration.
- A lawyer review is recommended before the project becomes public; cost is non-zero.

## Alternatives Considered

- **No CLA, AGPL-only forever**: simplest. Rejected because commercial licensing optionality has real business value.
- **Developer Certificate of Origin (DCO)**: lighter-weight than a CLA (no signature, just a commit trailer). Does not grant relicensing rights. Rejected for this reason.
- **Copyright assignment**: contributor signs over full copyright. More legally robust but a higher ask from contributors. CLA with relicensing reservation is the industry standard middle ground.
