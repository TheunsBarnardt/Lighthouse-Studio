# Objective 6: Multi-Tenancy and Authorization (RBAC)

**Status:** Ready for development
**Prerequisites:** Objectives 1, 1.5, 2, 3, 4 family, 5 complete
**Blocks:** Every feature objective (each one must enforce permissions correctly to ship)

---

## 1. Purpose

Implement workspace-level multi-tenancy and a role-based authorization system that the entire platform enforces *at the service layer* — not at the database layer (Mongo doesn't have RLS) and not at the UI layer (the UI hides; the server refuses).

This is the layer that turns "authenticated user" into "authorized to perform action X on resource Y in workspace Z." It also implements the **configurable approval routing** that's central to the platform's thesis: solo workflows have one approver everywhere; enterprise workflows route by role.

This objective produces no user-visible features directly. It produces the authorization spine that every later feature objective depends on. Done correctly, no feature can ship that violates tenant isolation or permission boundaries — those become structural impossibilities, not things to remember.

The hardest property to get right: **cross-workspace data leakage must be structurally impossible**, verified by tests that try to leak. If the test suite ever fails to detect a leak attempt, the whole authorization system has a bug that probably exists in production too.

---

## 2. Scope

### In Scope

- The `Workspace` and `WorkspaceMember` data model (plus migrations across all three database adapters)
- Workspace lifecycle: create, archive, restore, transfer ownership, delete
- Member lifecycle: invite, accept, remove, role change
- Role definitions: a base set plus user-defined custom roles
- Permission matrix: actions × resource types
- The `AuthorizationPort` — service-layer guard for every operation
- Workspace-scoped query enforcement: every query against a workspace-scoped table includes the workspace filter, automatically, with zero possibility of forgetting it
- Approval routing configuration: per-workspace, per-stage approver assignments (the central feature from the master plan)
- Service account / API token scaffolding (stubbed; full implementation deferred)
- Cross-tenant isolation property tests: aggressive attempts to leak; all must fail
- Audit events for every authorization decision (deny logged at info, grant at debug to control volume)
- Operational runbooks
- ADRs

### Out of Scope (Belongs to Later Objectives)

- Resource-level fine-grained permissions (e.g., "user X can edit this specific project but not others") — deferred until proven needed
- Attribute-based access control (ABAC) beyond what's needed for approval routing — deferred
- The data management module's per-customer-table permissions — that's part of the data management module
- Service account / API token full implementation — deferred to a separate objective
- LDAP/AD group sync as automatic role assignment — covered by the OIDC/Entra adapters already, but the wiring into role assignment is part of this objective's scope as a configuration option, not a separate identity flow
- The UI for managing workspaces and members — that's the data management module
- Billing / subscription-based feature gating — out of scope for this AGPL self-hosted product

---

## 3. Locked Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Tenancy unit | Workspace (top-level within the installation) | Locked from earlier objectives |
| Authorization model | RBAC with role inheritance, plus a small ABAC layer for approval routing | Standard, understandable, sufficient for 95% of needs |
| Permission representation | (action, resource_type) tuples; e.g., `('artifact.approve', 'artifact')` | Flat, queryable, exportable |
| Role storage | Database-backed with both built-in (immutable) and custom (user-defined) roles | Built-in roles are the spec; custom roles let workspaces customize without forking |
| Authorization enforcement | Service-layer `authorize(action, resource, ctx)` calls; ALL operations pass through this | Single, auditable enforcement point; portable across all three databases |
| Workspace isolation | Filter automatically injected by the persistence layer when the request context carries a workspaceId | Mechanical enforcement; not a thing developers can forget |
| Default policy | Deny (no role grant = no access) | OWASP standard |
| Permission caching | Per-request cache; cleared between requests | Performance without staleness risk |
| Roles for cross-workspace operations | Installation-level roles (`installation_owner`, `installation_admin`) | A small set of users who can act across workspaces (e.g., for DR or onboarding) |
| Approval routing model | Per-workspace stage configuration; each stage has a list of approver requirements | The central feature from the master plan |
| Approver requirements | Combinations: "any user with role X", "specific user Y", "N approvers from group Z", "all approvers from group Z" | Covers solo, small team, and enterprise patterns |
| Permission grants | Always positive (no "explicit deny"); intersection of role grants is the user's set | Simpler model; explicit-deny invites bugs |
| Role hierarchy | Roles can extend others (e.g., `architect extends developer`); circular dependencies forbidden | Reduces redundancy; common pattern |
| Membership join | Pending → Active → Archived states; pending requires acceptance | Standard invite flow |
| First user is workspace owner | Yes, automatically | Bootstrap |
| Workspace owner cannot be the only owner who removes themselves | Yes, owner removal requires another owner present | Prevents accidental orphaning |

---

## 4. Architectural Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                       SERVICE LAYER                                    │
│                                                                        │
│   Every operation:                                                     │
│   1. Receives a RequestContext (user, workspace, ip, correlationId)    │
│   2. Calls authorize(action, resource, ctx)                            │
│   3. If allowed, proceeds with workspace-scoped operations              │
│   4. Emits audit event with outcome                                    │
│                                                                        │
└─────────────────┬────────────────────────────────────────────────────┘
                  │
                  ▼
       ┌──────────────────────┐
       │  AuthorizationPort   │
       │                       │
       │  - decide(ctx, op)    │
       │  - listPermissions    │
       │  - explainDenial      │
       └──────────┬───────────┘
                  │ implemented by
                  ▼
       ┌──────────────────────┐
       │ authz-builtin adapter│
       │                       │
       │ Loads roles + grants  │
       │ from DB; evaluates    │
       │ against permission    │
       │ matrix; caches per-   │
       │ request               │
       └──────────┬───────────┘
                  │
                  ▼
       ┌──────────────────────┐
       │ Persistence layer    │
       │ (workspaces, roles,   │
       │  memberships, perms,  │
       │  approval_configs)    │
       └──────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│              WORKSPACE-SCOPED QUERY ENFORCEMENT                        │
│                                                                        │
│  Every repository method receives RequestContext:                       │
│    - if context has workspaceId AND entity is workspace-scoped:        │
│      automatically inject `workspace_id = ctx.workspaceId` filter       │
│    - if context lacks workspaceId AND entity is workspace-scoped:      │
│      reject the operation (programming error)                           │
│    - workspace-spanning operations require installation-level role     │
└──────────────────────────────────────────────────────────────────────┘
```

The most important property: a service-layer call without a `RequestContext` is impossible. The type system requires it on every operation. Forgetting it is a compile error, not a runtime bug.

---

## 5. The Hard Parts

**5.1 Workspace-spanning roles (installation-level)**

Most operations are workspace-scoped. But some — disaster recovery, bulk user provisioning, audit log inspection across workspaces, support-team operations — need to act outside any single workspace.

The platform supports this via **installation-level roles**, separate from workspace memberships:

- `installation_owner` — single-or-few users who installed the platform; full access
- `installation_admin` — operational role; can manage workspaces, users, system config; cannot delete the installation
- `installation_auditor` — read-only access to audit logs across all workspaces

These users do NOT automatically have access to workspace data — they have administrative rights, not membership. Reading project data inside a workspace requires being a workspace member or invoking specific cross-workspace audit operations that themselves are audited.

This separation prevents "the platform admin can read everyone's secrets" surprises while allowing legitimate operational actions.

**5.2 Permission inheritance and effective permissions**

A user's permissions in a workspace are the union of:
- Direct role assignments
- Inherited permissions via role hierarchy
- Implicit permissions from being workspace owner (if applicable)

Computing the effective permission set is non-trivial when role hierarchy is several levels deep. The platform precomputes effective permissions per (user, workspace) tuple and caches the result, invalidating on role changes.

The cache is **per-request, not global** — a new request always re-fetches. This is a deliberate trade-off: slight overhead per request in exchange for instant propagation of role changes (a removed user can't continue to act, even briefly).

**5.3 Default-deny propagation across the stack**

A common bug: feature code checks "user has permission X" but forgets to also filter the data accordingly. Result: the user gets a 403 if they try to act, but the LIST view shows them resources they shouldn't see.

The platform avoids this by enforcing scoping in two complementary places:

- **Authorization gates** (deny/allow decisions on operations)
- **Mandatory workspace filters** in all queries against workspace-scoped tables

Both layers are required; either alone is insufficient. The combination means: even if a feature author forgets to authorize, the query returns empty (because the user has no workspace context); even if they forget to filter, the operation is denied.

**5.4 Custom roles**

A workspace can define custom roles that are combinations of permissions or extensions of built-in roles:

```yaml
role: "qa_lead_with_release_authority"
extends: "qa_lead"
additional_permissions:
  - deploy.approve
  - release.publish
```

Custom roles live in the workspace's data; they're not a code change. This means an enterprise customer can express their internal roles without forking the platform.

The data management module's UI (later objective) provides a role editor. This objective produces the data model and the evaluation engine; the UI is downstream.

**5.5 Approval routing**

The platform's master thesis includes "configurable approval routing" — solo users approve everything themselves; enterprises route to BAs, designers, dev leads, QA, etc. This objective implements the routing data model and evaluation; the actual *approval* mechanism (creating approval records, marking them complete) is part of each feature objective that has gates.

The approval routing config per workspace looks like:

```yaml
approval_routes:
  intent_brief:
    require: any
    approvers:
      - role: workspace_owner
  prd:
    require: all
    approvers:
      - role: business_analyst
  design_tokens:
    require: any_n
    n: 1
    approvers:
      - role: designer
      - role: design_lead
  schema:
    require: all
    approvers:
      - role: architect
      - user: "specific-user-id"
  deploy_to_prod:
    require: all
    approvers:
      - role: ops_lead
      - role: release_manager
    additional_constraints:
      - business_hours_only: true
      - cooldown_hours: 24  # no deploy within 24h of another deploy
```

The same configuration covers:
- **Solo:** every stage routes to `workspace_owner` (just one user)
- **Enterprise:** every stage routes to the appropriate role
- Both modes use the same config schema; only the values differ

Solo and enterprise are configurations of the same machinery — exactly the master plan's thesis.

**5.6 Mandatory workspace context**

Every service method takes `RequestContext` as its first parameter. This context carries:

- `userId` — the authenticated user
- `workspaceId` — the workspace being acted on (if applicable)
- `installationRoles` — the user's installation-level roles (cached on auth)
- `correlationId` — for audit and tracing
- `ipAddress`, `userAgent` — for audit
- `mfaSatisfied` — whether the current session has MFA verified (for sensitive ops)

The TypeScript type forces this:

```typescript
interface ServiceMethodContext {
  ctx: RequestContext;
  // ... other params
}
```

Calls without context are compile errors. Internal methods that don't need authorization (e.g., a worker process running scheduled cleanup) take a `SystemContext` instead — explicitly typed as such, so it's visible in code review.

**5.7 The "trying to leak" tests**

The conformance test suite for authorization includes a **leakage detection battery**: hundreds of property-based tests that randomly:

- Create users in different workspaces
- Try every operation as every role
- Try cross-workspace operations
- Try sequences of operations that might bypass checks
- Try corrupt or crafted contexts (workspaceId mismatch with user's memberships, etc.)

For every attempt, the property tests assert: **either the operation is allowed and stays within the user's authorized scope, or it's denied with an audit log**. There must be no third outcome.

If a leakage test ever fails, that's a P0 incident — production has the same bug.

**5.8 Service accounts and API tokens (stubbed)**

Full implementation is deferred, but the data model accommodates them now:

- A "principal" is either a user or a service account
- Service accounts have permissions like users (via roles) but no MFA, no email, no sessions
- API tokens are bearer tokens authenticated against a service account

The schema includes `principals` table with a `type` discriminator (`user` | `service_account`); user-specific tables (sessions, MFA, email verifications) reference `principals.id` where the type is `user`.

This is a 5% extra complexity now to avoid a 50% migration later.

**5.9 Performance: permission checks happen on every operation**

Performance budget for `authorize()`: **p99 < 1ms** for cached, **p99 < 10ms** for cold.

The first call in a request fetches the user's effective permissions for the workspace and caches them in the request context. Subsequent calls hit the cache. Permissions don't change mid-request; if they do (e.g., role removed), the request completes with the old permissions, and the next request sees the new ones.

Cold cache is a single SQL/Mongo query against the `(user_id, workspace_id) → permissions` materialized view (in Postgres) or equivalent index in MSSQL/Mongo. The view is maintained by triggers (Postgres/MSSQL) or by application logic on role mutations (Mongo).

**5.10 Approval routing under role changes**

If a user is the configured approver for a stage, and they leave the workspace before approving, what happens?

- **Pending approvals reference user_id**, not role assignment at request time
- If a user leaves and they're a configured approver, the approval cannot be granted by them; the workspace owner is notified to either re-route or wait for the user to be re-added
- For role-based approvals ("any user with role X"), the approval can be granted by any current member with that role; the approver doesn't need to have been pre-assigned

This handling is documented and tested.

---

## 6. Component Specifications

### 6.1 Data Model

**`workspaces` table:**

```typescript
// Logical schema (translated to each adapter)

workspaces: {
  ...standardColumns,             // id, version, archived_at, timestamps
  name: string(255),
  slug: string(100),               // URL-safe, unique within installation
  description: text,
  ownerUserId: uuid,                // current primary owner (denormalized for perf)
  settings: json,                   // workspace-level config
  archivedReason: string(500)?,
}
unique: [slug]
indexes: [archived_at, owner_user_id]
```

**`workspace_members` table:**

```typescript
workspace_members: {
  ...standardColumns,
  workspaceId: uuid,
  userId: uuid,
  status: enum('pending', 'active', 'archived'),
  invitedAt: timestamp,
  acceptedAt: timestamp?,
  invitedByUserId: uuid?,
}
unique: [workspaceId, userId]
indexes: [workspaceId, userId, status]
```

**`workspace_member_roles` table:**

```typescript
workspace_member_roles: {
  ...standardColumns,
  workspaceMemberId: uuid,
  roleId: uuid,                    // refs workspace_roles or built-in role id
  grantedByUserId: uuid?,
}
unique: [workspaceMemberId, roleId]
```

**`workspace_roles` table:**

```typescript
workspace_roles: {
  ...standardColumns,
  workspaceId: uuid?,              // null = installation-level / built-in
  name: string(100),
  description: text,
  builtin: boolean,                 // built-in roles cannot be modified or deleted
  parentRoleId: uuid?,              // for inheritance
}
unique: [workspaceId, name]
```

**`role_permissions` table:**

```typescript
role_permissions: {
  ...standardColumns,
  roleId: uuid,
  action: string(100),              // e.g., 'artifact.approve'
  resourceType: string(100),         // e.g., 'artifact'
}
unique: [roleId, action, resourceType]
```

**`installation_role_assignments` table:**

```typescript
installation_role_assignments: {
  ...standardColumns,
  userId: uuid,
  role: enum('installation_owner', 'installation_admin', 'installation_auditor'),
  grantedByUserId: uuid?,
}
unique: [userId, role]
```

**`workspace_invitations` table:**

```typescript
workspace_invitations: {
  ...standardColumns,
  workspaceId: uuid,
  email: string(255),
  invitedByUserId: uuid,
  initialRoles: json,                // array of roleIds
  tokenHash: string,                 // HMAC of invitation token
  expiresAt: timestamp,
  acceptedAt: timestamp?,
  acceptedByUserId: uuid?,
}
unique: [tokenHash]
indexes: [email, expiresAt]
```

**`workspace_approval_routes` table:**

```typescript
workspace_approval_routes: {
  ...standardColumns,
  workspaceId: uuid,
  stage: string(100),                // e.g., 'prd', 'deploy_to_prod'
  config: json,                       // the routing configuration document
}
unique: [workspaceId, stage]
```

**`approvals` table** (created here; used by feature objectives):

```typescript
approvals: {
  ...standardColumns,
  workspaceId: uuid,
  resourceType: string(100),
  resourceId: uuid,
  stage: string(100),
  routeSnapshot: json,               // the routing config at the time of request, for audit
  state: enum('pending', 'approved', 'rejected', 'cancelled'),
  resolvedAt: timestamp?,
  resolvedByUserId: uuid?,
  resolution: json?,                  // approver list, decision details
}
indexes: [workspaceId, resourceType, resourceId, state]
```

### 6.2 Built-in Roles

The platform ships with these roles. They cannot be modified, but they can be extended via custom roles.

```yaml
installation_owner:
  description: "Full access across the installation"
  permissions:
    - "*"  # all permissions

installation_admin:
  description: "Operational administration"
  permissions:
    - "workspace.*"
    - "user.*"
    - "system.read"
  cannot:
    - "system.shutdown"

installation_auditor:
  description: "Read-only audit access"
  permissions:
    - "audit.read"
    - "workspace.read"

workspace_owner:
  description: "Full access to a workspace"
  permissions:
    - "workspace.*"   # within this workspace
    - "*.read"
    - "*.write"
    - "*.approve"

workspace_admin:
  description: "Manage workspace settings and members"
  permissions:
    - "workspace.read"
    - "workspace.update"
    - "member.*"
    - "role.*"

business_analyst:
  description: "Owns requirements and approvals at the requirements stage"
  permissions:
    - "intent_brief.*"
    - "prd.*"
    - "brd.*"
    - "approval.requirements.grant"

designer:
  description: "Owns design tokens and prototype stages"
  permissions:
    - "design_tokens.*"
    - "prototype.*"
    - "approval.design.grant"

architect:
  description: "Owns schema and architecture decisions"
  permissions:
    - "schema.*"
    - "approval.architecture.grant"

developer:
  description: "Builds features"
  permissions:
    - "ui.*"
    - "code.*"
    - "*.read"

qa:
  description: "Owns test definition and acceptance"
  permissions:
    - "test.*"
    - "approval.qa.grant"

ops:
  description: "Owns deployment and infrastructure"
  permissions:
    - "deploy.*"
    - "infrastructure.*"
    - "approval.deploy.grant"

reviewer:
  description: "Read everything; approve where assigned"
  permissions:
    - "*.read"
    - "approval.*.grant"  # only when assigned to a specific approval

viewer:
  description: "Read-only"
  permissions:
    - "*.read"
```

These roles map to the personas in the master plan. Customers extend them as needed — e.g., a custom `senior_developer` role that has both `developer` and `architect` rights.

### 6.3 Permission Vocabulary

Permissions are flat strings using `<resource>.<action>` convention. Wildcards `*` match any value.

**Resources** (the platform's vocabulary; each feature objective adds to this):
- `workspace`, `member`, `role`, `invitation`
- `intent_brief`, `prd`, `brd`, `design_tokens`, `prototype`, `schema`, `ui`, `code`, `test`, `deploy`
- `artifact` (generic; subsumes the above when generic logic applies)
- `audit`, `system`
- `data_table` (data management module's customer-defined tables)
- `data_row` (rows in customer-defined tables)

**Actions:**
- `read`, `write`, `update`, `archive`, `delete`, `restore`
- `create`, `list`
- `approve`, `reject`
- `invite`, `remove` (for membership)
- `assign`, `unassign` (for role assignments)

**Convention:** wildcard `*` is supported but logged at warn level when used in custom roles (it's powerful and probably worth a review).

### 6.4 AuthorizationPort

```typescript
// packages/ports/authorization/src/authorization.port.ts

export interface AuthorizationPort {
  /**
   * Decide whether the user (in the given context) can perform the action on the resource.
   * Returns ok(undefined) on allow, err(...) on deny.
   */
  authorize(
    ctx: RequestContext,
    action: string,
    resourceType: string,
    resourceContext?: ResourceContext
  ): Promise<Result<void, AuthorizationError>>;
  
  /**
   * Pre-compute and return all permissions a user has in a given workspace.
   * Used by the UI to disable buttons before the user clicks them.
   * Cached per request.
   */
  listEffectivePermissions(
    ctx: RequestContext,
    workspaceId: string
  ): Promise<Result<EffectivePermissionSet, AuthorizationError>>;
  
  /**
   * Explain why an authorization decision was made.
   * Returns the role chain that led to the decision (or denial).
   * For UI tooltips and admin debugging.
   */
  explain(
    ctx: RequestContext,
    action: string,
    resourceType: string
  ): Promise<Result<AuthorizationExplanation, AuthorizationError>>;
}

export interface RequestContext {
  userId: string;
  workspaceId?: string;       // optional — some operations are installation-scoped
  installationRoles: string[]; // installation-level roles
  correlationId: string;
  ipAddress?: string;
  userAgent?: string;
  mfaSatisfied: boolean;
  // Internal flags:
  readonly _kind: 'user' | 'service_account' | 'system';
}

export interface ResourceContext {
  /** The specific resource being acted on, if applicable. */
  resourceId?: string;
  /** The owner of the resource, if relevant for ownership-based checks. */
  ownerId?: string;
  /** Additional ABAC attributes for routing (e.g., approval stages). */
  attributes?: Record<string, unknown>;
}

export interface EffectivePermissionSet {
  workspaceId: string;
  permissions: Set<string>;     // e.g., 'artifact.read', 'prd.approve'
  fromRoles: string[];           // roles that contributed
  fromInstallationRoles: string[];
}

export interface AuthorizationExplanation {
  decision: 'allow' | 'deny';
  matchedRules: Array<{ ruleType: 'role_grant' | 'workspace_membership' | 'installation_role'; details: string }>;
  reason: string;
}
```

### 6.5 Service-Layer Enforcement Pattern

Every service method:

```typescript
// packages/core/src/services/project.service.ts

export class ProjectService {
  constructor(
    private authz: AuthorizationPort,
    private projects: RepositoryPort<Project>,
    private audit: AuditPort,
    private logger: LoggerPort,
  ) {}
  
  async create(ctx: RequestContext, input: CreateProjectInput): Promise<Result<Project, AppError>> {
    // 1. Authorize
    const authResult = await this.authz.authorize(ctx, 'project.create', 'project');
    if (authResult.isErr()) {
      await this.audit.write({ /* deny event */ });
      return err(authResult.error);
    }
    
    // 2. Validate input
    const validated = createProjectInputSchema.safeParse(input);
    if (!validated.success) return err(new ValidationError(/*...*/));
    
    // 3. Execute (workspace filter is automatically applied because ctx has workspaceId)
    const project = await this.projects.create({
      ...validated.data,
      workspaceId: ctx.workspaceId,
      createdBy: ctx.userId,
    });
    
    // 4. Audit
    await this.audit.write({ /* create event */ });
    
    return project;
  }
}
```

This pattern is repeated everywhere. A code review checklist (and the linter from Objective 1) catches missing authorize calls.

### 6.6 Workspace-Scoped Query Enforcement

Repositories (from Objective 4 family) get an additional layer: when a `RequestContext` is in scope, workspace-scoped tables automatically include `workspace_id = ctx.workspaceId` in every query.

Implementation: the service layer wraps repositories in a "context-bound" helper that injects the filter:

```typescript
// packages/core/src/repositories/context-bound-repo.ts

export function bindToContext<T>(
  repo: RepositoryPort<T>,
  ctx: RequestContext,
  isWorkspaceScoped: boolean,
): RepositoryPort<T> {
  if (!isWorkspaceScoped) return repo;
  if (!ctx.workspaceId) {
    return rejectAllRepo<T>(/* "workspace context required" */);
  }
  
  return wrapWithFilter(repo, { workspaceId: ctx.workspaceId });
}
```

The wrapper merges the workspace filter into every `findOne`, `findMany`, `count`, `update`, `archive`, `hardDelete` call. `create` operations have `workspaceId` set automatically.

Repository operations that genuinely need to span workspaces (e.g., installation-admin reports) explicitly opt out via a separate `unboundedRepo` that requires installation-level role check.

### 6.7 Approval Routing Engine

Lives in `packages/core/src/approvals/`. Takes:
- A workspace's approval route config
- A resource being approved (artifact id, stage)
- The current set of approvals on it

Returns:
- Is the approval requirement satisfied?
- If not, who can still approve?
- Audit-friendly explanation of the decision

```typescript
export interface ApprovalRoutingEngine {
  evaluate(
    config: ApprovalRouteConfig,
    workspace: Workspace,
    members: WorkspaceMember[],
    pendingApprovals: Approval[]
  ): Result<RoutingDecision, RoutingError>;
}

export interface RoutingDecision {
  satisfied: boolean;
  satisfiedBy: string[];       // user ids who fulfilled the requirement
  pendingApprovers: string[];   // user ids who can still approve
  blockedBy?: BlockReason;       // e.g., "business hours only" constraint not met
}
```

The engine handles the matrix of `require: any | all | any_n` × `approver: by_role | by_user | by_group`. Each combination is a tested case in the conformance suite.

### 6.8 Cross-Tenant Isolation Test Suite

`packages/core/tests/leak-tests/`:

- Property-based: generate random scenarios with two workspaces, users in different memberships, attempt every operation
- Specifically test: can user from workspace A read data in workspace B? Always must fail.
- Specifically test: can installation_admin read workspace data without being a member? Always must fail (admin operations are different from data access).
- Specifically test: can a user see resources via search/list operations from another workspace? Always must fail.
- Specifically test: can a user with no workspace context perform any workspace-scoped operation? Always must fail.

These tests run on every PR. A failure is a P0 — production has the same bug.

---

## 7. Implementation Order

1. **Schema migrations** for workspaces, members, roles, permissions, approval routes, approvals on all three database adapters.

2. **Built-in role definitions** seeded into the database via a "system migration" (creates the built-in roles on first install; idempotent).

3. **`AuthorizationPort` interface and conformance test suite.**

4. **`authz-builtin` adapter** implementing `AuthorizationPort`. Loads roles and grants from the database via persistence ports; evaluates against the permission matrix; caches per-request.

5. **Effective-permission materialized view** in Postgres; equivalent index structure in MSSQL; equivalent precomputation in Mongo.

6. **WorkspaceService**: create, archive, restore, transfer, delete operations. Each authorized; each audited.

7. **MemberService**: invite, accept, change role, remove. Email integration (uses EmailPort from Objective 5).

8. **InvitationService**: token generation, validation, expiry.

9. **Service-layer pattern** documented and a reference implementation is built (the WorkspaceService and MemberService themselves are the references).

10. **Workspace-scoped query enforcement** in the repository layer.

11. **Cross-tenant isolation test suite.**

12. **Approval routing engine** with all combination cases tested.

13. **Audit events** for every authorization decision and every workspace/member change.

14. **Performance benchmarks** for `authorize()`: p99 < 1ms cached, p99 < 10ms cold.

15. **Operational runbooks.**

16. **ADRs.**

17. **Verify Definition of Done.**

---

## 8. ADRs to Write

- **ADR-0060: Service-Layer Authorization (not RLS)** — why we enforce in code instead of database; portability and Mongo
- **ADR-0061: Workspace as Tenancy Unit** — confirms what's been said all along; clarifies what "tenant" means
- **ADR-0062: RBAC + Lightweight ABAC** — what we get with this hybrid; why not full ABAC
- **ADR-0063: Default Deny, Positive Grants Only** — no explicit-deny rules; simplicity
- **ADR-0064: Built-in Roles vs. Custom Roles** — built-in are immutable and ship with the platform; custom layer over them
- **ADR-0065: Approval Routing Configuration Model** — the central feature; how the config schema maps to solo vs. enterprise workflows
- **ADR-0066: Workspace-Scoped Query Auto-Injection** — why mechanical scoping; what could go wrong without it
- **ADR-0067: Per-Request Permission Cache** — perf vs. staleness trade-off

---

## 9. Verification Steps

1. **Schema migrations apply cleanly** on all three database adapters.

2. **Built-in roles are seeded** and present in a fresh installation.

3. **A user with no roles cannot do anything** — every authorize call returns deny.

4. **The first user of a workspace becomes its owner** automatically.

5. **An owner can do everything** in their workspace; cross-workspace operations require installation roles.

6. **Custom roles work** — create a custom role with specific permissions; assign to a user; verify the user can do exactly those things and no more.

7. **Role inheritance works** — a custom role extending `developer` has all developer permissions plus its own.

8. **Approval routing works** for all configurations: solo (one approver), small team (multiple), enterprise (role-based, multi-stage).

9. **Cross-tenant isolation tests pass** all property-based scenarios. No test ever finds a leak.

10. **Workspace-scoped queries auto-inject filters.** A repo call without workspace context fails; with context, the filter is applied; the test verifies the SQL/Mongo query actually includes the filter.

11. **Effective permissions cache** invalidates correctly on role changes within a transaction; doesn't propagate stale across requests.

12. **Performance**: `authorize()` p99 < 1ms cached, < 10ms cold (verified with benchmarks).

13. **Audit events** are emitted for: workspace create/update/archive/restore, member invite/accept/remove, role assign/unassign, permission grant decisions (denies always; grants at debug).

14. **Installation roles are separate from workspace memberships.** An installation_admin who isn't a member of workspace X cannot read workspace X's data via normal operations.

15. **Mass revocation** — removing a user from a workspace immediately invalidates their access (next request fails authorization).

16. **Owner cannot self-orphan** — last-owner cannot remove themselves; the operation returns a clear error.

17. **Invitations expire** correctly; expired invitations cannot be accepted.

18. **Service account scaffolding works** — a principal with `type: service_account` can be created, granted roles, and authorized; full implementation is deferred but the foundation works.

19. **Approval routing handles approver leaving workspace** correctly — pending approvals reference users who left are flagged; workspace owner notified.

20. **Documentation accurate** — all runbooks tested by following them.

If all 20 pass, the objective is met.

---

## 10. Definition of Done

**Schema and Data Model**
- [ ] All workspace/membership/role/permission/approval tables migrated on all three adapters
- [ ] Built-in roles seeded via system migration
- [ ] Conformance suite passes on all three adapters

**Authorization**
- [ ] `AuthorizationPort` defined with full contract
- [ ] `authz-builtin` adapter implemented and tested
- [ ] Per-request caching working
- [ ] Effective-permission materialized view (Postgres) / equivalents (MSSQL, Mongo)
- [ ] Permission vocabulary documented in `docs/contracts/permissions.md`

**Workspace Management**
- [ ] WorkspaceService: create, archive, restore, transfer, delete
- [ ] MemberService: invite, accept, change role, remove
- [ ] InvitationService: token-based invites with expiry
- [ ] Owner-cannot-self-orphan logic working

**Approval Routing**
- [ ] Routing config schema defined and documented
- [ ] Routing engine implemented; all combinations tested
- [ ] Solo, small team, enterprise scenarios verified
- [ ] Approver-leaves-workspace edge case handled

**Service Layer Pattern**
- [ ] `RequestContext` type forces context on every operation
- [ ] Reference implementation in WorkspaceService and MemberService
- [ ] Linter rule catches missing authorize calls
- [ ] Workspace-scoped query auto-injection working

**Cross-Tenant Isolation**
- [ ] Property-based leak detection suite running on every PR
- [ ] All leak attempts fail
- [ ] Performance: p99 < 1ms cached, < 10ms cold

**Custom Roles**
- [ ] Custom role creation works
- [ ] Role inheritance works
- [ ] Built-in roles cannot be modified
- [ ] Wildcards in custom roles flagged at warn level

**Installation-Level Roles**
- [ ] `installation_owner`, `installation_admin`, `installation_auditor` roles defined
- [ ] Cross-workspace operations require installation roles
- [ ] Installation admin doesn't get workspace data access automatically

**Audit**
- [ ] Every authorization decision logged (deny info, grant debug)
- [ ] Every workspace/member change logged

**Documentation**
- [ ] ADRs 0060–0067 written and Accepted
- [ ] `docs/contracts/permissions.md` enumerates all permissions
- [ ] Runbooks for: granting installation roles, recovering from no-owners scenario, mass member revocation

**Verification**
- [ ] All 20 verification steps in Section 9 pass

---

## 11. Anti-Patterns to Refuse

- **Skipping `authorize()` because "this endpoint is internal."** Every operation. Always.
- **Calling `authorize()` after the operation, "just to log."** Authorize first, then act. Otherwise you've done the thing before deciding it was allowed.
- **Trusting `workspace_id` from the request body.** It comes from the authenticated context. Body parameters are inputs to validation, not authority.
- **Materializing the entire permission matrix in code as if statements.** The data model is the matrix; queries are the evaluation; if statements are an antipattern.
- **Using "deny rules" or "explicit deny."** The model is positive grants. If a user shouldn't have a permission, don't grant it.
- **Treating wildcards as the default.** Wildcards in built-in roles are deliberate. Wildcards in custom roles trigger a warn.
- **Caching permissions across requests.** Per-request only.
- **Letting the test suite skip leak tests "because they're slow."** They run on every PR. Slowing the loop is preferable to leaks reaching production.
- **Adding a new permission without adding it to `docs/contracts/permissions.md`.** Permissions are the contract; undocumented permissions are bugs waiting to happen.
- **Allowing service code to import directly from `authz-builtin`.** Adapter access goes through the composition root only; service code knows only the port.
- **Writing role evaluations in TypeScript that the database doesn't understand.** All role evaluation goes through the same engine; if a feature needs custom evaluation, the engine is extended (with conformance tests), not bypassed.

---

## 12. Open Questions for Confirmation Before Starting

1. **Permission vocabulary scope** — proposing the resources and actions in Section 6.3. Confirmed, or expand/contract?

2. **Role customization depth** — propose: built-in roles immutable; custom roles can extend any role (built-in or custom); inheritance up to 5 levels deep. Acceptable?

3. **Installation auditor role** — gives read access to ALL audit logs across ALL workspaces. Necessary for some compliance scenarios; controversial because it's a privacy concern. Confirmed worth having?

4. **Approval routing configuration UI** — out of scope for this objective (engine only); will land with the data management module's admin UI. Acceptable to ship engine-only here?

5. **Approver-leaves-workspace handling** — proposing: pending approvals stuck on a departed user are flagged; workspace owner notified; owner can re-route or wait. Alternative: auto-rerouting based on role. Recommendation: notify owner, let them decide. Confirmed?

6. **Performance budget for `authorize()`** — p99 < 1ms cached, p99 < 10ms cold. If this is too tight after measurement, we relax. If we hit it easily, we keep it as-is. Acceptable framing?

---

## 13. What Comes Next

With Objective 6 complete, the platform has correct, mechanical, tested multi-tenancy and authorization. Every operation in every later feature objective will go through this layer. Cross-tenant leakage is structurally impossible.

**Objective 7: Audit and Compliance** consolidates the audit infrastructure (already partly built across earlier objectives), adds retention policies, exports, and compliance posture documents.

**Objective 8: Service Layer Architecture** formalizes the service patterns established here (RequestContext, repository binding, audit emission) into reusable conventions and ensures every later feature follows them.

**Objective 9: Cross-Platform Runtime** ensures the platform actually runs on Windows Server (not just Linux), needed for Microsoft house customers.

**Objective 10: Quality Gates Before Stage One** consolidates the foundation into a reviewable bundle: load tests, penetration tests, chaos tests, compliance checklist. Once that ships, **Stage 1 (Intent Capture)** of the AI build pipeline can begin.

In parallel with Stage 1+ work, the **Data Management Module** can also begin — it's the Supabase clone with all the database, identity, RBAC, and audit infrastructure already in place beneath it.

---

*This document is the contract. Every checkbox in Section 10 must be true before moving on.*
