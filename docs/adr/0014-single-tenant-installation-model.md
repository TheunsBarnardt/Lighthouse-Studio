# ADR-0014: Single-Tenant Installation Model

**Status:** Accepted
**Date:** 2026-05-02
**Deciders:** solo (Theuns Barnardt)

## Context

The platform is self-hosted. It must define whether one running installation serves one organization or many. The choice propagates throughout the data model, authorization layer, and backup/recovery strategy.

## Decision

The platform uses a **single-tenant installation model**:

- One installation = one organization. The installation belongs entirely to that organization.
- There is no `Organization` entity in the data model. The installation is the implicit organization.
- **Workspaces** are the top-level tenancy boundary inside an installation. They subdivide by department, product, client engagement, or any grouping the customer chooses.
- Users belong to the installation and may be members of zero, one, or many workspaces.
- Cross-workspace queries are forbidden by default. Authorization is enforced at the workspace boundary at the service layer.
- Backups, exports, and disaster recovery operate at the installation level.

Implications for the abstraction layer:

- Audit entries carry `workspaceId`, never `organizationId`.
- `UserDirectoryPort` manages installation-wide users.
- Every multi-tenant-style query carries a `workspaceId` filter.

**Out of scope:** hosted multi-tenancy (one running instance, many isolated organizations) is a different deployment mode and a different product configuration. It is not implemented in this platform.

## Consequences

### Positive

- The data model is simpler: no tenant isolation at the database layer, no row-level security per organization.
- Backup and recovery are straightforward: one database, one backup.
- Security model is clearer: workspace boundary is the only isolation boundary that matters.
- Self-hosted enterprises are the primary customer; they expect to own their installation.

### Negative

- Customers who want to offer the platform as a service to their own customers cannot do so with one installation — they need multiple installations.
- If the platform ever pivots to hosted SaaS, this model requires significant rework.

## Alternatives Considered

- **Full multi-tenancy from day one**: one installation, many organizations with complete isolation. Rejected because: (a) the target customer is self-hosted enterprises, not SaaS providers; (b) full multi-tenancy adds significant complexity to every query, migration, and backup operation; (c) it can be added later if the market demands it.
- **Tenant-per-schema (Postgres schema isolation)**: each organization gets a schema. Rejected because it doesn't work across MSSQL and MongoDB equivalently.
