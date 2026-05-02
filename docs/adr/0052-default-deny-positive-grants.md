---
adr: 0052
title: Default Deny with Positive Grants Only — No Explicit Deny Rules
status: Accepted
date: 2026-05-02
deciders: Theuns Barnardt
objective: objectives/06-multi-tenancy-rbac.md
---

## Context

Two common authorization models:

1. **Positive grants only** — a user has a permission only if a role explicitly grants it. Absence of a grant = deny.
2. **Positive grants + explicit deny** — grants can be overridden by explicit deny rules, allowing "grant this role but block this one action."

Many systems (AWS IAM, for example) support explicit deny because it makes certain policies easier to express. But explicit deny also introduces complexity: policy evaluation must check for denies, interaction between grants and denies requires careful ordering, and auditing "why was this denied?" becomes harder.

## Decision

**Default deny, positive grants only. No explicit deny rules.**

If a user should not have a permission, the correct action is to not grant it — not to add a deny rule on top of a grant. Custom roles can be scoped precisely to the permissions a user needs.

Wildcards in custom roles (`*` as action or resource) are logged at warn level to flag unusually broad grants.

## Consequences

- Permission evaluation is simple: union of role grants, check if the requested permission is in the set
- No "grant A, deny B" conflicts to reason about
- Auditing is straightforward: "user had permission because role X granted it"
- Creating a custom role requires explicitly listing allowed permissions (cannot "start from owner, remove one thing")
- The warn on wildcards gives operators visibility into broad grants

## Alternatives Considered

**Explicit deny**: More expressive but significantly more complex. Explicit deny must be evaluated first, before grants. The interaction between deny on a parent role and grant on a child role is non-obvious. The platform's threat model does not require explicit deny.
