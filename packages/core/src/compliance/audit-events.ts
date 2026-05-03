// ── Audit Event Taxonomy ──────────────────────────────────────────────────────
//
// Complete enumeration of every audit event type the platform emits.
// CI verifies that all event types used in code are listed here.
//
// Event type format: <area>.<entity?>.<action> (dotted, lowercase, past-tense action)
// e.g. 'auth.signin.succeeded', 'workspace.member.removed'

export const AUDIT_EVENTS = {
  // ── Authentication ──────────────────────────────────────────────────────────
  AUTH_SIGNIN_SUCCEEDED: 'auth.signin.succeeded',
  AUTH_SIGNIN_FAILED: 'auth.signin.failed',
  AUTH_SIGNIN_LOCKED_OUT: 'auth.signin.locked_out',
  AUTH_SIGNOUT_COMPLETED: 'auth.signout.completed',
  AUTH_SESSION_CREATED: 'auth.session.created',
  AUTH_SESSION_REFRESHED: 'auth.session.refreshed',
  AUTH_SESSION_REVOKED: 'auth.session.revoked',
  AUTH_PASSWORD_SET: 'auth.password.set',
  AUTH_PASSWORD_RESET_REQUESTED: 'auth.password.reset_requested',
  AUTH_EMAIL_VERIFIED: 'auth.email.verified',
  AUTH_EMAIL_CHANGED: 'auth.email.changed',
  AUTH_MFA_ENROLLED: 'auth.mfa.enrolled',
  AUTH_MFA_DISABLED: 'auth.mfa.disabled',
  AUTH_MFA_FAILED: 'auth.mfa.failed',
  AUTH_IDENTITY_LINKED: 'auth.identity.linked',
  AUTH_IDENTITY_UNLINKED: 'auth.identity.unlinked',
  AUTH_USER_CREATED: 'auth.user.created',
  AUTH_USER_ARCHIVED: 'auth.user.archived',
  AUTH_USER_RESTORED: 'auth.user.restored',
  AUTH_USER_HARD_DELETED: 'auth.user.hard_deleted',

  // ── Workspace ───────────────────────────────────────────────────────────────
  WORKSPACE_CREATED: 'workspace.created',
  WORKSPACE_UPDATED: 'workspace.updated',
  WORKSPACE_ARCHIVED: 'workspace.archived',
  WORKSPACE_RESTORED: 'workspace.restored',
  WORKSPACE_DELETED: 'workspace.deleted',
  WORKSPACE_TRANSFERRED: 'workspace.transferred',

  // ── Workspace members ────────────────────────────────────────────────────────
  WORKSPACE_MEMBER_INVITED: 'workspace.member.invited',
  WORKSPACE_MEMBER_ACCEPTED: 'workspace.member.accepted',
  WORKSPACE_MEMBER_REMOVED: 'workspace.member.removed',
  WORKSPACE_MEMBER_ROLE_ASSIGNED: 'workspace.member.role_assigned',
  WORKSPACE_MEMBER_ROLE_REMOVED: 'workspace.member.role_removed',

  // ── Workspace roles ──────────────────────────────────────────────────────────
  WORKSPACE_ROLE_CREATED: 'workspace.role.created',
  WORKSPACE_ROLE_UPDATED: 'workspace.role.updated',
  WORKSPACE_ROLE_DELETED: 'workspace.role.deleted',

  // ── Workspace approval routing ───────────────────────────────────────────────
  WORKSPACE_APPROVAL_ROUTE_UPDATED: 'workspace.approval_route.updated',

  // ── Artifacts ───────────────────────────────────────────────────────────────
  ARTIFACT_CREATED: 'artifact.created',
  ARTIFACT_UPDATED: 'artifact.updated',
  ARTIFACT_ARCHIVED: 'artifact.archived',
  ARTIFACT_RESTORED: 'artifact.restored',
  ARTIFACT_APPROVED: 'artifact.approved',
  ARTIFACT_REJECTED: 'artifact.rejected',
  ARTIFACT_CHANGES_REQUESTED: 'artifact.changes_requested',

  // ── Deployments ─────────────────────────────────────────────────────────────
  DEPLOY_INITIATED: 'deploy.initiated',
  DEPLOY_COMPLETED: 'deploy.completed',
  DEPLOY_FAILED: 'deploy.failed',
  DEPLOY_ROLLED_BACK: 'deploy.rolled_back',

  // ── Data subject rights (GDPR) ───────────────────────────────────────────────
  DATA_SUBJECT_ACCESS_REQUESTED: 'data.subject.access_requested',
  DATA_SUBJECT_ACCESS_COMPLETED: 'data.subject.access_completed',
  DATA_SUBJECT_ERASURE_REQUESTED: 'data.subject.erasure_requested',
  DATA_SUBJECT_ERASURE_COMPLETED: 'data.subject.erasure_completed',

  // ── Audit management ─────────────────────────────────────────────────────────
  AUDIT_EXPORT_CREATED: 'audit.export.created',
  AUDIT_CHAIN_VERIFIED: 'audit.chain.verified',
  AUDIT_RETENTION_ENFORCED: 'audit.retention.enforced',

  // ── System ──────────────────────────────────────────────────────────────────
  SYSTEM_CONFIG_CHANGED: 'system.config.changed',
  SYSTEM_MIGRATION_APPLIED: 'system.migration.applied',
  SYSTEM_BACKUP_COMPLETED: 'system.backup.completed',
} as const;

export type AuditEventType = (typeof AUDIT_EVENTS)[keyof typeof AUDIT_EVENTS];

/** All registered event types as a set, for CI validation. */
export const REGISTERED_AUDIT_EVENT_TYPES: ReadonlySet<string> = new Set(
  Object.values(AUDIT_EVENTS),
);
