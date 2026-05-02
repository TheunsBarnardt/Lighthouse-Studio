---
adr: 0051
title: RBAC + Lightweight ABAC for Approval Routing
status: Accepted
date: 2026-05-02
deciders: Theuns Barnardt
objective: objectives/06-multi-tenancy-rbac.md
---

## Context

The platform needs two distinct authorization concerns:

1. **Who can do what?** — "Can this user create a PRD?" — this is classic RBAC.
2. **Who must approve what?** — "Which roles must sign off before this PRD advances?" — this requires knowing _who_ has a particular role at a particular stage, which is attribute-based.

Pure RBAC handles concern 1 well but concern 2 awkwardly: you'd have to create separate roles for every approval stage combination, which explodes the role count.

Pure ABAC handles both, but is complex to implement, audit, and understand.

## Decision

**RBAC with a lightweight ABAC layer specifically for approval routing.**

- Access control decisions (can a user perform an action?) use RBAC: roles → permissions → allow/deny.
- Approval routing decisions (who must approve at stage X?) use the `ApprovalRoutingEngine`, which evaluates a per-workspace config against role membership. This is ABAC limited to the approval routing domain.
- The ABAC layer does not affect authorization decisions — it only determines who is eligible to approve.

## Consequences

- Approximately 95% of authorization decisions remain pure RBAC: simple, fast, well-understood
- Approval routing is configuration, not code: workspace admins configure it without developer involvement
- The ABAC surface is bounded to approval routing, making it auditable
- Future resource-level fine-grained permissions (if ever needed) would require a proper ABAC extension

## Alternatives Considered

**Full ABAC**: Expressive but complex. Enterprises have seen full ABAC deployments become unmaintainable. Not worth the cost for a platform where most decisions are role-based.

**Pure RBAC with stage-specific roles**: Workable but creates role explosion (e.g., `prd_approver_stage_1`, `deploy_approver_prod`). Harder to configure and maintain.
