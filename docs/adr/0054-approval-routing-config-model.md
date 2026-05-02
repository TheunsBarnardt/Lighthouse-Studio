---
adr: 0054
title: Approval Routing Configuration Model — Per-Workspace, Per-Stage
status: Accepted
date: 2026-05-02
deciders: Theuns Barnardt
objective: objectives/06-multi-tenancy-rbac.md
---

## Context

The platform's central thesis is that the same pipeline serves solo developers and enterprise teams, with approval routing being the key differentiator.

A solo developer wants: "I approve everything myself."
An enterprise wants: "PRD requires all of {BA, Architect}; deploy-to-prod requires ops lead + release manager, during business hours, with a 24h cooldown."

These must be the same mechanism, not two code paths.

## Decision

**Approval routing is a per-workspace configuration document (`workspace_approval_routes` table), with one row per stage.**

The configuration schema:

```typescript
interface ApprovalRouteConfig {
  require: 'any' | 'all' | 'any_n';
  n?: number; // used with 'any_n'
  approvers: ApproverSpec[]; // by role or by specific userId
  additionalConstraints?: AdditionalConstraint[];
}
```

`require` modes:

- `any` — any one approver from the list satisfies the requirement
- `all` — every spec must be satisfied (one approver per spec)
- `any_n` — at least N approvers from the pool must approve

`additionalConstraints`:

- `businessHoursOnly: true` — blocks approval outside 08:00–18:00 UTC
- `cooldownHours: N` — prevents re-approval within N hours of the previous one

Solo configuration: every stage routes to `{ role: 'workspace_owner' }` with `require: any`.
Enterprise: stages route to appropriate roles with `require: all` or `any_n`.

The `ApprovalRoutingEngine` evaluates the config against current workspace membership. It is pure (no side effects) and can be tested without a database.

## Consequences

- Solo and enterprise are identical code paths with different config values
- Config is stored in JSON, inspectable and exportable for audit
- Adding a new stage in a later objective requires adding one row to `workspace_approval_routes`; no code change needed
- The engine is testable: feed config + members + existing approvals → get a decision
- `routeSnapshot` on `approvals` preserves the config at decision time (immutable audit record)

## Alternatives Considered

**Hard-coded approval logic per stage**: Fast to build, but cannot serve enterprise customization without code changes. Defeats the master plan thesis.

**External workflow engine (Temporal, Camunda)**: Powerful but heavy dependency for v1. The routing engine covers the platform's needs without an external orchestrator.
