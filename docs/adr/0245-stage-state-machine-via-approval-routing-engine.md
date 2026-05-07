# ADR-0245: Stage State Machine via ApprovalRoutingEngine

**Status:** Accepted
**Date:** 2026-05-06
**Objective:** 20 (AI Pipeline Foundation)

---

## Context

Every AI pipeline artifact progresses through `draft → in_review → approved / rejected → superseded`. This lifecycle requires approval routing (who must approve), transition guards (can't approve a draft), and audit trails. The platform already has an approval workflow engine (`ApprovalRoutingEngine` in `packages/core/src/approvals/`) built for Objective 7. Reimplementing lifecycle state management in each pipeline stage would duplicate logic and diverge.

---

## Decision

`StagePipelineService` is a thin adapter that translates artifact lifecycle operations into `ApprovalRoutingEngine` calls:

- `submitForApproval(ctx, artifactId)` → creates an approval request via the engine, sets artifact status to `in_review`
- `recordDecision(ctx, approvalId, decision)` → delegates to the engine; on `approved`, sets artifact status to `approved`; on `rejected`, sets to `rejected`
- `autoApprove(ctx, artifactId)` → used for solo-workspace configurations where no other approvers exist

Artifact status transitions are the only writes `StagePipelineService` makes to the artifact record; all other artifact mutations go through `ArtifactService`.

Audit events are emitted per transition: `ai.artifact.submitted`, `ai.artifact.approved`, `ai.artifact.rejected`.

---

## Consequences

**What becomes easier:**

- Approval routing configuration (which roles must approve at which stages) is centralized in the existing workspace approval configuration — not duplicated per stage.
- Solo-workspace auto-approval is a single configuration flag, not special-cased per stage.
- The full approval audit trail is inherited.

**What becomes harder:**

- Stage-specific approval customization (e.g., "require two approvers for PRD but one for intent brief") must go through the `ApprovalRoutingEngine` configuration model, not ad-hoc code. This is a feature, not a limitation, but it means configuring approval rules rather than writing code.

---

## Alternatives Considered

- **Per-stage approval logic:** Rejected — duplicates routing, escalation, and deadline logic.
- **Simple boolean `approved` field with no workflow:** Rejected — doesn't support multi-approver or time-bounded review; doesn't produce an approval audit trail.
- **External workflow engine (Temporal, Prefect):** Rejected — significant infrastructure dependency; the in-process engine handles the required workflows.
