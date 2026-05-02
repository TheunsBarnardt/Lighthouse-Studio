import type {
  Approval,
  ApprovalRouteConfig,
  WorkspaceMember,
  WorkspaceMemberRole,
  WorkspaceRole,
} from '@platform/ports-authorization';

export interface RoutingDecision {
  satisfied: boolean;
  satisfiedBy: string[];
  pendingApprovers: string[];
  blockedBy?: BlockReason;
}

export interface BlockReason {
  kind: 'business_hours' | 'cooldown';
  message: string;
}

export interface EvaluationInput {
  config: ApprovalRouteConfig;
  members: WorkspaceMember[];
  memberRoles: WorkspaceMemberRole[];
  roles: WorkspaceRole[];
  existingApprovals: Approval[];
  /** UTC hour (0–23) for business-hours constraint evaluation. */
  currentUtcHour?: number;
  /** Timestamp of the last approval for the same resource+stage, if any. */
  lastApprovalAt?: Date;
}
