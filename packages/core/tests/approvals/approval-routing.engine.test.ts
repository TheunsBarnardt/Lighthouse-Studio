import type {
  Approval,
  ApprovalRouteConfig,
  WorkspaceMember,
  WorkspaceMemberRole,
  WorkspaceRole,
} from '@platform/ports-authorization';

import { describe, expect, it } from 'vitest';

import type { EvaluationInput } from '../../src/approvals/types.js';

import { ApprovalRoutingEngine } from '../../src/approvals/approval-routing.engine.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeMember(overrides?: Partial<WorkspaceMember>): WorkspaceMember {
  const now = new Date();
  return {
    id: 'member-1',
    version: 1,
    workspaceId: 'ws-1',
    userId: 'user-1',
    status: 'active',
    invitedAt: now,
    acceptedAt: now,
    invitedByUserId: null,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
    createdBy: null,
    updatedBy: null,
    ...overrides,
  };
}

function makeRole(id: string, name: string, parentRoleId?: string): WorkspaceRole {
  const now = new Date();
  return {
    id,
    version: 1,
    workspaceId: 'ws-1',
    name,
    description: null,
    builtin: false,
    parentRoleId: parentRoleId ?? null,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
    createdBy: null,
    updatedBy: null,
  };
}

function makeMemberRole(memberId: string, roleId: string): WorkspaceMemberRole {
  const now = new Date();
  return {
    id: `mr-${memberId}-${roleId}`,
    version: 1,
    workspaceMemberId: memberId,
    roleId,
    grantedByUserId: null,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
    createdBy: null,
    updatedBy: null,
  };
}

function makeApproval(resolvedByUserId: string, state: Approval['state'] = 'approved'): Approval {
  const now = new Date();
  return {
    id: `approval-${resolvedByUserId}`,
    version: 1,
    workspaceId: 'ws-1',
    resourceType: 'prd',
    resourceId: 'resource-1',
    stage: 'prd',
    routeSnapshot: { require: 'any', approvers: [] },
    state,
    resolvedAt: state !== 'pending' ? now : null,
    resolvedByUserId: state !== 'pending' ? resolvedByUserId : null,
    resolution: null,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
    createdBy: null,
    updatedBy: null,
  };
}

function makeInput(overrides?: Partial<EvaluationInput>): EvaluationInput {
  const member1 = makeMember({ id: 'member-1', userId: 'user-1' });
  const member2 = makeMember({ id: 'member-2', userId: 'user-2' });
  const role1 = makeRole('role-ba', 'business_analyst');
  const role2 = makeRole('role-owner', 'workspace_owner');

  return {
    config: { require: 'any', approvers: [{ role: 'business_analyst' }] },
    members: [member1, member2],
    memberRoles: [makeMemberRole('member-1', 'role-ba'), makeMemberRole('member-2', 'role-owner')],
    roles: [role1, role2],
    existingApprovals: [],
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ApprovalRoutingEngine', () => {
  const engine = new ApprovalRoutingEngine();

  describe('require: any', () => {
    it('is not satisfied when no approvals exist', () => {
      const result = engine.evaluate(makeInput());
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.satisfied).toBe(false);
        expect(result.value.pendingApprovers).toContain('user-1');
      }
    });

    it('is satisfied when one eligible approver has approved', () => {
      const result = engine.evaluate(makeInput({ existingApprovals: [makeApproval('user-1')] }));
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.satisfied).toBe(true);
        expect(result.value.satisfiedBy).toContain('user-1');
        expect(result.value.pendingApprovers).toHaveLength(0);
      }
    });

    it('is not satisfied when approver is not a member', () => {
      const result = engine.evaluate(makeInput({ existingApprovals: [makeApproval('user-99')] }));
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.satisfied).toBe(false);
      }
    });

    it('is not satisfied when approver has the wrong role', () => {
      const result = engine.evaluate(makeInput({ existingApprovals: [makeApproval('user-2')] }));
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.satisfied).toBe(false);
      }
    });
  });

  describe('require: all', () => {
    function allInput(): EvaluationInput {
      const member1 = makeMember({ id: 'member-1', userId: 'user-1' });
      const member2 = makeMember({ id: 'member-2', userId: 'user-2' });
      const roleBA = makeRole('role-ba', 'business_analyst');
      const roleArch = makeRole('role-arch', 'architect');
      const config: ApprovalRouteConfig = {
        require: 'all',
        approvers: [{ role: 'business_analyst' }, { role: 'architect' }],
      };
      return {
        config,
        members: [member1, member2],
        memberRoles: [
          makeMemberRole('member-1', 'role-ba'),
          makeMemberRole('member-2', 'role-arch'),
        ],
        roles: [roleBA, roleArch],
        existingApprovals: [],
      };
    }

    it('is not satisfied when only one of two specs is approved', () => {
      const result = engine.evaluate({
        ...allInput(),
        existingApprovals: [makeApproval('user-1')],
      });
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.satisfied).toBe(false);
        expect(result.value.pendingApprovers).toContain('user-2');
      }
    });

    it('is satisfied when both specs are approved', () => {
      const result = engine.evaluate({
        ...allInput(),
        existingApprovals: [makeApproval('user-1'), makeApproval('user-2')],
      });
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.satisfied).toBe(true);
      }
    });
  });

  describe('require: any_n', () => {
    it('is satisfied when n approvers have approved', () => {
      const m1 = makeMember({ id: 'member-1', userId: 'user-1' });
      const m2 = makeMember({ id: 'member-2', userId: 'user-2' });
      const m3 = makeMember({ id: 'member-3', userId: 'user-3' });
      const role = makeRole('role-rev', 'reviewer');
      const config: ApprovalRouteConfig = {
        require: 'any_n',
        n: 2,
        approvers: [{ role: 'reviewer' }],
      };
      const result = engine.evaluate({
        config,
        members: [m1, m2, m3],
        memberRoles: [
          makeMemberRole('member-1', 'role-rev'),
          makeMemberRole('member-2', 'role-rev'),
          makeMemberRole('member-3', 'role-rev'),
        ],
        roles: [role],
        existingApprovals: [makeApproval('user-1'), makeApproval('user-2')],
      });
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.satisfied).toBe(true);
        expect(result.value.satisfiedBy).toHaveLength(2);
      }
    });

    it('is not satisfied when fewer than n have approved', () => {
      const m1 = makeMember({ id: 'member-1', userId: 'user-1' });
      const role = makeRole('role-rev', 'reviewer');
      const config: ApprovalRouteConfig = {
        require: 'any_n',
        n: 2,
        approvers: [{ role: 'reviewer' }],
      };
      const result = engine.evaluate({
        config,
        members: [m1],
        memberRoles: [makeMemberRole('member-1', 'role-rev')],
        roles: [role],
        existingApprovals: [makeApproval('user-1')],
      });
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.satisfied).toBe(false);
      }
    });
  });

  describe('specific-user approver', () => {
    it('is satisfied only when the designated user approves', () => {
      const member = makeMember({ id: 'member-1', userId: 'user-specific' });
      const config: ApprovalRouteConfig = {
        require: 'any',
        approvers: [{ userId: 'user-specific' }],
      };
      const notYet = engine.evaluate({
        config,
        members: [member],
        memberRoles: [],
        roles: [],
        existingApprovals: [],
      });
      expect(notYet.isOk() && !notYet.value.satisfied).toBe(true);

      const done = engine.evaluate({
        config,
        members: [member],
        memberRoles: [],
        roles: [],
        existingApprovals: [makeApproval('user-specific')],
      });
      expect(done.isOk() && done.value.satisfied).toBe(true);
    });
  });

  describe('role inheritance', () => {
    it('a child role inherits parent permissions for approval matching', () => {
      const member = makeMember({ id: 'member-1', userId: 'user-1' });
      // senior_ba extends business_analyst
      const roleBA = makeRole('role-ba', 'business_analyst');
      const roleSeniorBA = makeRole('role-senior-ba', 'senior_ba', 'role-ba');
      const config: ApprovalRouteConfig = {
        require: 'any',
        approvers: [{ role: 'business_analyst' }],
      };
      const result = engine.evaluate({
        config,
        members: [member],
        memberRoles: [makeMemberRole('member-1', 'role-senior-ba')],
        roles: [roleBA, roleSeniorBA],
        existingApprovals: [makeApproval('user-1')],
      });
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.satisfied).toBe(true);
      }
    });
  });

  describe('additional constraints', () => {
    it('blocks approval outside business hours', () => {
      const member = makeMember({ id: 'member-1', userId: 'user-1' });
      const config: ApprovalRouteConfig = {
        require: 'any',
        approvers: [{ userId: 'user-1' }],
        additionalConstraints: [{ businessHoursOnly: true }],
      };
      const result = engine.evaluate({
        config,
        members: [member],
        memberRoles: [],
        roles: [],
        existingApprovals: [],
        currentUtcHour: 3, // 3am UTC
      });
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.satisfied).toBe(false);
        expect(result.value.blockedBy?.kind).toBe('business_hours');
      }
    });

    it('allows approval during business hours', () => {
      const member = makeMember({ id: 'member-1', userId: 'user-1' });
      const config: ApprovalRouteConfig = {
        require: 'any',
        approvers: [{ userId: 'user-1' }],
        additionalConstraints: [{ businessHoursOnly: true }],
      };
      const result = engine.evaluate({
        config,
        members: [member],
        memberRoles: [],
        roles: [],
        existingApprovals: [makeApproval('user-1')],
        currentUtcHour: 10, // 10am UTC
      });
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.satisfied).toBe(true);
        expect(result.value.blockedBy).toBeUndefined();
      }
    });

    it('blocks approval during cooldown period', () => {
      const member = makeMember({ id: 'member-1', userId: 'user-1' });
      const config: ApprovalRouteConfig = {
        require: 'any',
        approvers: [{ userId: 'user-1' }],
        additionalConstraints: [{ cooldownHours: 24 }],
      };
      const lastApprovalAt = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2h ago
      const result = engine.evaluate({
        config,
        members: [member],
        memberRoles: [],
        roles: [],
        existingApprovals: [],
        lastApprovalAt,
      });
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.satisfied).toBe(false);
        expect(result.value.blockedBy?.kind).toBe('cooldown');
      }
    });
  });

  describe('archived members are excluded', () => {
    it('does not count approval from an archived member', () => {
      const archived = makeMember({ id: 'member-1', userId: 'user-1', status: 'archived' });
      const config: ApprovalRouteConfig = {
        require: 'any',
        approvers: [{ userId: 'user-1' }],
      };
      const result = engine.evaluate({
        config,
        members: [archived],
        memberRoles: [],
        roles: [],
        existingApprovals: [makeApproval('user-1')],
      });
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        // user-1 is archived, so they're not in activeMembers — approval not counted
        expect(result.value.satisfied).toBe(false);
      }
    });
  });
});
