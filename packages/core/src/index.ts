// Domain entities and service layer — business logic lives here.

// ── Errors ────────────────────────────────────────────────────────────────────
export {
  AppError,
  ApprovalAlreadyResolvedError,
  ConflictError,
  ForbiddenError,
  InvitationAlreadyAcceptedError,
  InvitationExpiredError,
  NotFoundError,
  OwnerSelfOrphanError,
  ValidationError,
  WorkspaceContextRequiredError,
} from './errors.js';
export type { AppErrorKind } from './errors.js';

// ── Context ───────────────────────────────────────────────────────────────────
export {
  auditMeta,
  isInstallationAdmin,
  isInstallationAuditor,
  isInstallationOwner,
  makeSystemContext,
  requireWorkspaceId,
} from './context.js';

// ── Repository helpers ────────────────────────────────────────────────────────
export { bindToContext } from './repositories/context-bound-repo.js';

// ── Services ──────────────────────────────────────────────────────────────────
export { WorkspaceService } from './services/workspace.service.js';
export type {
  ArchiveWorkspaceInput,
  CreateWorkspaceInput,
  TransferOwnershipInput,
  UpdateWorkspaceInput,
} from './services/workspace.service.js';

export { MemberService } from './services/member.service.js';
export type { ChangeRoleInput, RemoveMemberInput } from './services/member.service.js';

export { InvitationService } from './services/invitation.service.js';
export type { CreateInvitationInput } from './services/invitation.service.js';

// ── Approval routing ──────────────────────────────────────────────────────────
export { ApprovalRoutingEngine } from './approvals/approval-routing.engine.js';
export type { BlockReason, EvaluationInput, RoutingDecision } from './approvals/types.js';
