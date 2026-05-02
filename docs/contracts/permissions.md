# Platform Permission Vocabulary

_This document is authoritative. Every permission in the platform is listed here. Adding a new permission without updating this file is a bug._

_Format: `action:resource_type`. Wildcards (`*`) are valid in role definitions only._

---

## Resources

| Resource                | Description                                                             |
| ----------------------- | ----------------------------------------------------------------------- |
| `workspace`             | A workspace and its configuration                                       |
| `member`                | Workspace membership records                                            |
| `role`                  | Role definitions (custom roles)                                         |
| `invitation`            | Workspace invitations                                                   |
| `intent_brief`          | Stage 1 — intent capture documents                                      |
| `prd`                   | Stage 2 — Product Requirements Document                                 |
| `brd`                   | Stage 2 — Business Requirements Document                                |
| `design_tokens`         | Stage 3 — design token sets                                             |
| `prototype`             | Stage 3 — UI prototypes                                                 |
| `schema`                | Stage 4 — database/API schema definitions                               |
| `ui`                    | Stage 5 — generated UI code                                             |
| `code`                  | Stage 5 — generated server code                                         |
| `test`                  | Stage 6 — test suites                                                   |
| `deploy`                | Stage 7 — deployment configurations and runs                            |
| `artifact`              | Generic artifact (used when stage-specific resource type is not needed) |
| `approval`              | Approval records and routing configurations                             |
| `approval.requirements` | Approval decisions at the requirements stage                            |
| `approval.design`       | Approval decisions at the design stage                                  |
| `approval.architecture` | Approval decisions at the architecture stage                            |
| `approval.qa`           | Approval decisions at the QA stage                                      |
| `approval.deploy`       | Approval decisions at the deploy stage                                  |
| `data_table`            | Customer-defined tables in the data management module                   |
| `data_row`              | Rows in customer-defined tables                                         |
| `audit`                 | Audit log entries                                                       |
| `system`                | Platform system configuration                                           |
| `user`                  | User management (installation-level)                                    |

---

## Actions

| Action               | Description                                                        |
| -------------------- | ------------------------------------------------------------------ |
| `read`               | Read/view a resource                                               |
| `list`               | List resources                                                     |
| `create`             | Create a new resource                                              |
| `write`              | Create or update a resource                                        |
| `update`             | Update an existing resource                                        |
| `archive`            | Soft-delete a resource                                             |
| `restore`            | Restore an archived resource                                       |
| `delete`             | Hard-delete a resource                                             |
| `invite`             | Invite a user to a workspace                                       |
| `remove`             | Remove a member from a workspace                                   |
| `assign`             | Assign a role to a member                                          |
| `unassign`           | Remove a role from a member                                        |
| `approve`            | Approve a resource (advance through a stage gate)                  |
| `reject`             | Reject a resource                                                  |
| `grant`              | Grant an approval decision (for stage-specific approval resources) |
| `transfer_ownership` | Transfer workspace ownership                                       |

---

## Built-in Role Permissions

### Installation-level

| Role                   | Permissions                                        |
| ---------------------- | -------------------------------------------------- |
| `installation_owner`   | `*:*` — full access to everything                  |
| `installation_admin`   | `*:workspace`, `*:member`, `*:user`, `read:system` |
| `installation_auditor` | `read:audit`, `read:workspace`                     |

### Workspace-level

| Role               | Permissions Summary                                                                                |
| ------------------ | -------------------------------------------------------------------------------------------------- |
| `workspace_owner`  | `*` on all workspace resources                                                                     |
| `workspace_admin`  | `read:workspace`, `update:workspace`, `*:member`, `*:role`, `*:invitation`                         |
| `business_analyst` | `*:intent_brief`, `*:prd`, `*:brd`, `grant:approval.requirements`                                  |
| `designer`         | `*:design_tokens`, `*:prototype`, `grant:approval.design`                                          |
| `architect`        | `*:schema`, `grant:approval.architecture`                                                          |
| `developer`        | `*:ui`, `*:code`, `read:intent_brief`, `read:prd`, `read:brd`, `read:design_tokens`, `read:schema` |
| `qa`               | `*:test`, `grant:approval.qa`                                                                      |
| `ops`              | `*:deploy`, `grant:approval.deploy`                                                                |
| `reviewer`         | `read` on all content resources                                                                    |
| `viewer`           | `read` on all content resources (same as reviewer, without approval grant)                         |

---

## Custom Role Guidelines

1. Custom roles extend built-in roles via `parentRoleId` and inherit their permissions.
2. Custom roles cannot remove inherited permissions — only add new ones.
3. Wildcard actions or resources in custom roles (`*`) trigger a warning log. Review is recommended.
4. Custom roles are workspace-scoped (`workspace_id` is set).
5. Maximum inheritance depth: 5 levels.

---

## Adding a New Permission

1. Add the resource and/or action to this document.
2. Add the permission to the relevant built-in role(s) in `packages/adapters/authz-builtin/src/built-in-roles.ts`.
3. Write a test verifying the permission is granted to the right role and denied to others.
4. Run the seeder in a migration or on startup — `seedBuiltInRoles()` is idempotent and will add the new permission to existing built-in roles.

_Never add a permission without documenting it here first._
