---
adr: 0050
title: Workspace as the Tenancy Unit
status: Accepted
date: 2026-05-02
deciders: Theuns Barnardt
objective: objectives/06-multi-tenancy-rbac.md
---

## Context

The platform is a self-hosted installation. One company installs one instance. Within that installation, the company may have multiple independent teams or projects that should not share data.

We need to decide what the isolation boundary is: the whole installation, an "organization", a "project", or something else.

## Decision

**A workspace is the tenancy boundary.** Within one installation there are many workspaces. Every piece of business data (projects, artifacts, approvals, team configurations) belongs to exactly one workspace. Users are members of workspaces; they are not globally "in" or "out" of the installation.

The installation-level concept exists only for operational roles: `installation_owner`, `installation_admin`, `installation_auditor`. These roles govern the platform itself, not the data inside workspaces. An installation admin who is not a workspace member cannot read that workspace's data.

## Consequences

- Workspace IDs are the primary data partitioning key; all workspace-scoped tables carry `workspace_id`
- Cross-workspace queries require installation-level roles and are explicitly modeled as separate operations
- The platform can support a company-internal multi-team setup (e.g., "frontend team", "backend team") without separate installs
- Solo users get a single workspace; enterprise customers get multiple workspaces with independent access control

## Alternatives Considered

**Organization above workspace**: Would require an extra layer of hierarchy with no clear benefit for a self-hosted single-tenant install. The installation itself serves as the "organization."

**Project as the tenancy unit**: Too fine-grained. Projects within a team share access control. A workspace groups projects under one access policy.
