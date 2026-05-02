import { z } from 'zod';

// ── Request context ────────────────────────────────────────────────────────────

/**
 * Carries identity and workspace scope through every service call.
 * Every service method must accept this as its first parameter.
 * Forgetting it is a compile error.
 */
export interface RequestContext {
  readonly userId: string;
  /** Present for workspace-scoped operations; absent for installation-scoped ones. */
  readonly workspaceId?: string;
  /** Installation-level roles cached at authentication time. */
  readonly installationRoles: ReadonlyArray<InstallationRole>;
  readonly correlationId: string;
  readonly ipAddress?: string;
  readonly userAgent?: string;
  /** Whether the current session has satisfied MFA for sensitive operations. */
  readonly mfaSatisfied: boolean;
  readonly _kind: 'user' | 'service_account';
}

/**
 * Used by background workers and internal platform processes that are not
 * acting on behalf of any user. Explicitly typed so it is visible in review.
 */
export interface SystemContext {
  readonly correlationId: string;
  readonly _kind: 'system';
  readonly subsystem: string;
}

export type AnyContext = RequestContext | SystemContext;

// ── Roles ──────────────────────────────────────────────────────────────────────

export type InstallationRole = 'installation_owner' | 'installation_admin' | 'installation_auditor';

export type BuiltInWorkspaceRole =
  | 'workspace_owner'
  | 'workspace_admin'
  | 'business_analyst'
  | 'designer'
  | 'architect'
  | 'developer'
  | 'qa'
  | 'ops'
  | 'reviewer'
  | 'viewer';

export type BuiltInRole = InstallationRole | BuiltInWorkspaceRole;

// ── Domain entities ────────────────────────────────────────────────────────────

export interface Workspace {
  id: string;
  version: number;
  name: string;
  slug: string;
  description: string | null;
  ownerUserId: string;
  settings: Record<string, unknown>;
  archivedReason: string | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
}

export type WorkspaceMemberStatus = 'pending' | 'active' | 'archived';

export interface WorkspaceMember {
  id: string;
  version: number;
  workspaceId: string;
  userId: string;
  status: WorkspaceMemberStatus;
  invitedAt: Date;
  acceptedAt: Date | null;
  invitedByUserId: string | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
}

export interface WorkspaceMemberRole {
  id: string;
  version: number;
  workspaceMemberId: string;
  roleId: string;
  grantedByUserId: string | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
}

export interface WorkspaceRole {
  id: string;
  version: number;
  workspaceId: string | null;
  name: string;
  description: string | null;
  builtin: boolean;
  parentRoleId: string | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
}

export interface RolePermission {
  id: string;
  version: number;
  roleId: string;
  action: string;
  resourceType: string;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
}

export interface InstallationRoleAssignment {
  id: string;
  version: number;
  userId: string;
  role: InstallationRole;
  grantedByUserId: string | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
}

export interface WorkspaceInvitation {
  id: string;
  version: number;
  workspaceId: string;
  email: string;
  invitedByUserId: string;
  initialRoles: string[];
  tokenHash: string;
  expiresAt: Date;
  acceptedAt: Date | null;
  acceptedByUserId: string | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
}

// ── Approval routing ───────────────────────────────────────────────────────────

export type ApprovalRequireMode = 'any' | 'all' | 'any_n';

export interface ApproverSpec {
  /** Approve by any active member holding this role. */
  role?: string;
  /** Approve by this specific user. */
  userId?: string;
}

export interface AdditionalConstraint {
  businessHoursOnly?: boolean;
  /** Minimum hours since the last deployment of the same resource. */
  cooldownHours?: number;
}

export interface ApprovalRouteConfig {
  require: ApprovalRequireMode;
  /** Required when mode is any_n. */
  n?: number;
  approvers: ApproverSpec[];
  additionalConstraints?: AdditionalConstraint[];
}

export interface WorkspaceApprovalRoute {
  id: string;
  version: number;
  workspaceId: string;
  stage: string;
  config: ApprovalRouteConfig;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
}

export type ApprovalState = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface Approval {
  id: string;
  version: number;
  workspaceId: string;
  resourceType: string;
  resourceId: string;
  stage: string;
  /** Snapshot of routing config at the time the approval was requested. */
  routeSnapshot: ApprovalRouteConfig;
  state: ApprovalState;
  resolvedAt: Date | null;
  resolvedByUserId: string | null;
  resolution: Record<string, unknown> | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
}

// ── Authorization decision types ───────────────────────────────────────────────

export interface ResourceContext {
  resourceId?: string;
  ownerId?: string;
  attributes?: Record<string, unknown>;
}

export interface EffectivePermissionSet {
  workspaceId: string;
  permissions: Set<string>;
  fromRoles: string[];
  fromInstallationRoles: string[];
}

export interface AuthorizationExplanation {
  decision: 'allow' | 'deny';
  matchedRules: Array<{
    ruleType: 'role_grant' | 'workspace_membership' | 'installation_role';
    details: string;
  }>;
  reason: string;
}

// ── Zod schemas ────────────────────────────────────────────────────────────────

// Schema inferred type intentionally not annotated as ZodType<ApprovalRouteConfig> because
// Zod's optional() infers `T | undefined` which conflicts with exactOptionalPropertyTypes.
// Use .parse() with a cast at call sites, or validate with zodParse below.
export const ApprovalRouteConfigSchema = z.object({
  require: z.enum(['any', 'all', 'any_n']),
  n: z.number().int().min(1).optional(),
  approvers: z.array(
    z.object({
      role: z.string().optional(),
      userId: z.string().optional(),
    }),
  ),
  additionalConstraints: z
    .array(
      z.object({
        businessHoursOnly: z.boolean().optional(),
        cooldownHours: z.number().int().min(0).optional(),
      }),
    )
    .optional(),
});
