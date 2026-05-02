---
adr: 0053
title: Built-in Roles Are Immutable; Custom Roles Layer Over Them
status: Accepted
date: 2026-05-02
deciders: Theuns Barnardt
objective: objectives/06-multi-tenancy-rbac.md
---

## Context

The platform ships with a set of named roles (`workspace_owner`, `developer`, `qa`, etc.) that correspond to the personas described in the master plan. Customers will inevitably want to customize these roles or add new ones.

Options:

1. Ship default roles that customers can modify freely.
2. Ship immutable built-in roles that customers extend with custom roles.
3. Ship a few base permissions and let customers define everything.

## Decision

**Built-in roles are immutable and ship with the platform. Customers add custom roles that can extend built-in roles via the `parentRoleId` inheritance chain.**

Built-in roles are identified by `builtin = true` and `workspace_id = null`. They cannot be modified or deleted. They represent the platform's intended personas.

A custom role can extend any built-in role: `parentRoleId` points to the built-in role, and the custom role inherits all its permissions plus adds its own.

Example:

```
senior_developer (custom)
  extends: developer (built-in)
  additional: schema.approve
```

## Consequences

- Platform upgrades can safely modify built-in role permissions without conflicting with custom roles (custom roles override by addition, not mutation)
- Customers get the "right" roles out of the box; customization is layered on top
- `builtin = true` rows are seeded on first install and re-seeded idempotently on upgrade
- Custom roles cannot _remove_ a permission from a parent role — only add. This is consistent with positive-grants-only (ADR-0052)

## Alternatives Considered

**Fully mutable built-in roles**: Simpler for quick customization, but platform upgrades could conflict with customer changes (e.g., we add a permission to `developer`; customer removed it; upgrade overwrites their change).

**Only primitives, no built-in roles**: Maximum flexibility, zero guidance. Not suitable for a product targeting teams that want fast onboarding.
