# ADR-0167: Section-Level Approval Routing

**Status:** Accepted
**Date:** 2026-05-07
**Objective:** 22 (Stage 2: PRD Generation)

## Context

A PRD has 10 sections covering different aspects of a product: user-facing content (personas, user stories), business content (goals, out of scope), and technical content (non-functional requirements, constraints, risks). In practice, different people are qualified to review different sections. A business analyst is the right approver for user stories and functional requirements; a software architect is the right approver for non-functional requirements and technical constraints. Requiring both to approve every section, or either to approve sections outside their expertise, does not match how real review workflows operate.

There is a simpler alternative: approve the whole PRD at once, or have a single designated approver for the entire document. This is administratively simpler but loses the granularity that makes staged reviews practical. A BA who has approved the user stories section should not have that approval nullified because the architect is still reviewing the non-functional requirements section — those are independent concerns.

Objective 6 already implemented a configurable approval routing engine supporting per-stage configuration with `any_of` and `all_of` modes. The question is whether to extend this to per-section routing or use a coarser PRD-level configuration.

## Decision

Approval routing is configured per section type, not per PRD. Each section type in `approval_routes.prd` has an `approvers` list and a `mode` (`any_of` | `all_of`). The PRD transitions to "approved" when all 10 sections are individually approved.

Solo workspaces default to `approvers: [workspace_owner], mode: any_of` for all sections — one click per section. Enterprise workspaces can configure distinct approvers per section type. The routing engine from Objective 6 handles both cases without modification; the difference is configuration, not code.

A section's approval state is independent of all other sections. Approving the `user_stories` section does not affect the approval state of `functional_requirements`. Rejecting `non_functional_requirements` does not invalidate approved sections.

## Rationale

1. **Expertise alignment.** Business analysts, architects, and product managers have domain-specific expertise. Per-section routing lets workspaces direct each section to the right reviewer rather than forcing every approver to review every section.

2. **Parallel review.** With per-section independence, a BA can approve user-facing sections while the architect is still reviewing technical sections. The reviews proceed in parallel, reducing total time to PRD approval.

3. **Preserved approved work.** When one section is revised and re-submitted for approval, only that section's approval is invalidated. The other nine sections retain their approval states. This is only possible because approval is per-section.

4. **Reuses Objective 6's engine.** The approval routing engine already supports per-resource routing with configurable modes. Adding PRD sections as a routing scope requires configuration, not a new engine.

5. **Solo and enterprise parity.** The same code path serves both. A solo user experiences one-click approval per section; an enterprise team experiences routed approvals. No special-casing required.

## Consequences

**Easier:**

- Parallel review by multiple stakeholders with different section ownership
- Section revisions don't invalidate unrelated approvals
- Clear audit trail: each section has its own approval record with approver identity and timestamp

**Harder:**

- Workspace configuration is more detailed (10 section routes vs. one PRD route)
- Default configuration must be sensible enough that teams don't need to configure anything for common cases
- UI must show per-section approval state clearly without overwhelming the reviewer

**Alternatives considered:**

- **Single approver for the whole PRD:** Simplest configuration; rejected because it forces serialized review, doesn't reflect real team structures, and invalidates all approvals when any section needs revision.
- **Per-PRD routing (one config for all sections):** Simpler than per-section; rejected because it still requires all designated approvers to review all sections regardless of expertise, which doesn't match real workflows for mixed-expertise teams.
