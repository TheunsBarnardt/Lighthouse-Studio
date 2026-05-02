import type {
  ApproverSpec,
  WorkspaceMember,
  WorkspaceMemberRole,
  WorkspaceRole,
} from '@platform/ports-authorization';

import { err, ok, type Result } from 'neverthrow';

import type { BlockReason, EvaluationInput, RoutingDecision } from './types.js';

// ── Helpers ────────────────────────────────────────────────────────────────────

function getRoleIdsForMember(memberId: string, memberRoles: WorkspaceMemberRole[]): string[] {
  return memberRoles
    .filter((mr) => mr.workspaceMemberId === memberId && !mr.archivedAt)
    .map((mr) => mr.roleId);
}

function getRoleNames(roleIds: string[], roles: WorkspaceRole[]): string[] {
  return roles.filter((r) => roleIds.includes(r.id) && !r.archivedAt).map((r) => r.name);
}

/** Collect all effective role names for a member, walking the inheritance chain. */
function getEffectiveRoleNames(
  memberId: string,
  memberRoles: WorkspaceMemberRole[],
  roles: WorkspaceRole[],
): Set<string> {
  const roleIds = getRoleIdsForMember(memberId, memberRoles);
  const visited = new Set<string>();
  const queue = [...roleIds];

  while (queue.length > 0) {
    const id = queue.shift();
    if (!id || visited.has(id)) continue;
    visited.add(id);
    const role = roles.find((r) => r.id === id);
    if (role?.parentRoleId && !visited.has(role.parentRoleId)) {
      queue.push(role.parentRoleId);
    }
  }

  return new Set(getRoleNames([...visited], roles));
}

/**
 * Determine which active members satisfy a single ApproverSpec.
 */
function membersMatchingSpec(
  spec: ApproverSpec,
  activeMembers: WorkspaceMember[],
  memberRoles: WorkspaceMemberRole[],
  roles: WorkspaceRole[],
): string[] {
  const matching: string[] = [];

  for (const member of activeMembers) {
    if (spec.userId) {
      if (member.userId === spec.userId) matching.push(member.userId);
      continue;
    }
    if (spec.role) {
      const effectiveRoles = getEffectiveRoleNames(member.id, memberRoles, roles);
      if (effectiveRoles.has(spec.role)) matching.push(member.userId);
    }
  }

  return matching;
}

/**
 * Build the set of user IDs that already approved (have resolved state = 'approved').
 */
function approvedUserIds(existingApprovals: EvaluationInput['existingApprovals']): Set<string> {
  return new Set(
    existingApprovals
      .filter((a) => a.state === 'approved' && a.resolvedByUserId)
      .map((a) => a.resolvedByUserId as string),
  );
}

// ── Engine ─────────────────────────────────────────────────────────────────────

export class ApprovalRoutingEngine {
  evaluate(input: EvaluationInput): Result<RoutingDecision, Error> {
    const { config, members, memberRoles, roles, existingApprovals } = input;

    const activeMembers = members.filter((m) => m.status === 'active' && !m.archivedAt);
    const alreadyApproved = approvedUserIds(existingApprovals);

    // ── Check additional constraints before evaluating approvals ──────────────

    const constraints = config.additionalConstraints ?? [];

    for (const constraint of constraints) {
      if (constraint.businessHoursOnly) {
        const hour = input.currentUtcHour ?? new Date().getUTCHours();
        // Business hours: 08:00–18:00 UTC (a sensible default; configurable in a future objective)
        if (hour < 8 || hour >= 18) {
          const blockReason: BlockReason = {
            kind: 'business_hours',
            message:
              'Approvals for this stage are only permitted during business hours (08:00–18:00 UTC)',
          };
          return ok({
            satisfied: false,
            satisfiedBy: [],
            pendingApprovers: [],
            blockedBy: blockReason,
          });
        }
      }

      if (constraint.cooldownHours !== undefined && input.lastApprovalAt) {
        const msSinceLast = Date.now() - input.lastApprovalAt.getTime();
        const cooldownMs = constraint.cooldownHours * 60 * 60 * 1000;
        if (msSinceLast < cooldownMs) {
          const remainingMs = cooldownMs - msSinceLast;
          const remainingHours = Math.ceil(remainingMs / (1000 * 60 * 60));
          const blockReason: BlockReason = {
            kind: 'cooldown',
            message: `Cooldown active: ${String(remainingHours)}h remaining before next approval`,
          };
          return ok({
            satisfied: false,
            satisfiedBy: [],
            pendingApprovers: [],
            blockedBy: blockReason,
          });
        }
      }
    }

    // ── Build candidate approver sets per spec ─────────────────────────────────

    const specsWithCandidates = config.approvers.map((spec) => ({
      spec,
      candidates: membersMatchingSpec(spec, activeMembers, memberRoles, roles),
    }));

    // Flatten all potential approvers across all specs
    const allCandidateIds = new Set(specsWithCandidates.flatMap((s) => s.candidates));

    // Who among the candidates has already approved?
    const alreadyApprovedCandidates = [...alreadyApproved].filter((uid) =>
      allCandidateIds.has(uid),
    );

    // Who among the candidates has not yet approved?
    const pendingCandidates = [...allCandidateIds].filter((uid) => !alreadyApproved.has(uid));

    // ── Evaluate satisfaction based on mode ───────────────────────────────────

    switch (config.require) {
      case 'any': {
        const satisfied = alreadyApprovedCandidates.length > 0;
        return ok({
          satisfied,
          satisfiedBy: alreadyApprovedCandidates,
          pendingApprovers: satisfied ? [] : pendingCandidates,
        });
      }

      case 'all': {
        // Every spec must be satisfied by at least one of its candidates
        const unsatisfiedSpecs = specsWithCandidates.filter(({ candidates }) => {
          return !candidates.some((uid) => alreadyApproved.has(uid));
        });
        const satisfied = unsatisfiedSpecs.length === 0;

        const stillPending = unsatisfiedSpecs.flatMap(({ candidates }) =>
          candidates.filter((uid) => !alreadyApproved.has(uid)),
        );

        return ok({
          satisfied,
          satisfiedBy: alreadyApprovedCandidates,
          pendingApprovers: satisfied ? [] : [...new Set(stillPending)],
        });
      }

      case 'any_n': {
        const n = config.n ?? 1;
        const satisfied = alreadyApprovedCandidates.length >= n;
        return ok({
          satisfied,
          satisfiedBy: alreadyApprovedCandidates,
          pendingApprovers: satisfied ? [] : pendingCandidates,
        });
      }

      default: {
        const _exhaustive: never = config.require;
        return err(new Error(`Unknown require mode: ${String(_exhaustive)}`));
      }
    }
  }
}
