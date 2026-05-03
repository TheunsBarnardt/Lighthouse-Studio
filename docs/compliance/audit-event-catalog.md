# Audit Event Catalog

_Auto-generated from `packages/core/src/compliance/audit-events.ts`. Do not edit manually._

_Last updated: 2026-05-02_

Every audit event emitted by the platform is listed here. CI verifies that all event types used in the codebase are registered in this catalog.

## Format

Event types follow the pattern `<area>.<entity?>.<action>` — dotted, lowercase, past-tense action.

---

## Authentication (`auth.*`)

| Event Type                      | Description                                  | Actor            |
| ------------------------------- | -------------------------------------------- | ---------------- |
| `auth.signin.succeeded`         | User successfully signed in                  | user             |
| `auth.signin.failed`            | Sign-in attempt failed (wrong credentials)   | user (attempted) |
| `auth.signin.locked_out`        | Account locked after repeated failures       | system           |
| `auth.signout.completed`        | User explicitly signed out                   | user             |
| `auth.session.created`          | New authenticated session created            | user             |
| `auth.session.refreshed`        | Session token refreshed                      | user             |
| `auth.session.revoked`          | Session revoked (logout or admin action)     | user / admin     |
| `auth.password.set`             | Password set or changed                      | user             |
| `auth.password.reset_requested` | Password reset email requested               | user             |
| `auth.email.verified`           | Email address verified                       | user             |
| `auth.email.changed`            | Email address updated                        | user             |
| `auth.mfa.enrolled`             | MFA (TOTP) enrolled                          | user             |
| `auth.mfa.disabled`             | MFA disabled                                 | user / admin     |
| `auth.mfa.failed`               | MFA verification failed                      | user             |
| `auth.identity.linked`          | External identity provider linked            | user             |
| `auth.identity.unlinked`        | External identity provider unlinked          | user / admin     |
| `auth.user.created`             | New user account created                     | user / system    |
| `auth.user.archived`            | User account archived (soft-deleted)         | user / admin     |
| `auth.user.restored`            | Archived user restored                       | admin            |
| `auth.user.hard_deleted`        | User hard-deleted after erasure grace period | system           |

---

## Workspace (`workspace.*`)

| Event Type                         | Description                            | Actor              |
| ---------------------------------- | -------------------------------------- | ------------------ |
| `workspace.created`                | New workspace created                  | user               |
| `workspace.updated`                | Workspace settings updated             | user               |
| `workspace.archived`               | Workspace archived                     | user / admin       |
| `workspace.restored`               | Archived workspace restored            | admin              |
| `workspace.deleted`                | Workspace hard-deleted                 | installation_owner |
| `workspace.transferred`            | Workspace ownership transferred        | workspace_owner    |
| `workspace.member.invited`         | User invited to workspace              | workspace_admin    |
| `workspace.member.accepted`        | Invitation accepted                    | user               |
| `workspace.member.removed`         | Member removed from workspace          | workspace_admin    |
| `workspace.member.role_assigned`   | Role(s) assigned to member             | workspace_admin    |
| `workspace.member.role_removed`    | Role(s) removed from member            | workspace_admin    |
| `workspace.role.created`           | Custom role created                    | workspace_admin    |
| `workspace.role.updated`           | Custom role permissions updated        | workspace_admin    |
| `workspace.role.deleted`           | Custom role deleted                    | workspace_admin    |
| `workspace.approval_route.updated` | Approval routing configuration changed | workspace_admin    |

---

## Artifacts (`artifact.*`)

| Event Type                   | Description                            | Actor    |
| ---------------------------- | -------------------------------------- | -------- |
| `artifact.created`           | Artifact (PRD, schema, etc.) created   | user     |
| `artifact.updated`           | Artifact updated                       | user     |
| `artifact.archived`          | Artifact archived                      | user     |
| `artifact.restored`          | Artifact restored                      | user     |
| `artifact.approved`          | Artifact approved via approval routing | reviewer |
| `artifact.rejected`          | Artifact rejected via approval routing | reviewer |
| `artifact.changes_requested` | Changes requested on artifact          | reviewer |

---

## Deployments (`deploy.*`)

| Event Type           | Description                       | Actor         |
| -------------------- | --------------------------------- | ------------- |
| `deploy.initiated`   | Deployment started                | user / system |
| `deploy.completed`   | Deployment completed successfully | system        |
| `deploy.failed`      | Deployment failed                 | system        |
| `deploy.rolled_back` | Deployment rolled back            | user / system |

---

## Data Subject Rights (`data.subject.*`)

| Event Type                       | Description                               | Actor        |
| -------------------------------- | ----------------------------------------- | ------------ |
| `data.subject.access_requested`  | GDPR Article 15 access request initiated  | user / admin |
| `data.subject.access_completed`  | Access export ready for download          | system       |
| `data.subject.erasure_requested` | GDPR Article 17 erasure request initiated | user / admin |
| `data.subject.erasure_completed` | Erasure completed after grace period      | system       |

---

## Audit Management (`audit.*`)

| Event Type                 | Description                                 | Actor                     |
| -------------------------- | ------------------------------------------- | ------------------------- |
| `audit.export.created`     | Audit log export downloaded                 | workspace_owner / auditor |
| `audit.chain.verified`     | Hash chain integrity verification completed | admin / system            |
| `audit.retention.enforced` | Retention enforcement job executed          | system                    |

---

## System (`system.*`)

| Event Type                 | Description                        | Actor              |
| -------------------------- | ---------------------------------- | ------------------ |
| `system.config.changed`    | Installation configuration changed | installation_admin |
| `system.migration.applied` | Database migration applied         | system             |
| `system.backup.completed`  | Database backup completed          | system             |

---

## Notes

- All events include `outcome: success | failure | denied`. An event with `outcome: denied` means the action was attempted but blocked by authorization.
- PII fields in audit metadata (e.g. `actor_email_snapshot`) are tagged for redaction when exporting to non-auditor roles.
- The catalog is the contract. Adding a new event type requires updating `audit-events.ts` and this catalog in the same PR.
