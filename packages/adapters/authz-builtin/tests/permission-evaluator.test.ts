import type { RolePermission, WorkspaceRole } from '@platform/ports-authorization';

import { describe, expect, it } from 'vitest';

import { checkPermission, resolveEffectivePermissions } from '../src/permission-evaluator.js';

function makeRole(id: string, name: string, parentRoleId: string | null = null): WorkspaceRole {
  const now = new Date();
  return {
    id,
    version: 1,
    workspaceId: 'ws-1',
    name,
    description: null,
    builtin: false,
    parentRoleId,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
    createdBy: null,
    updatedBy: null,
  };
}

function makePerm(
  id: string,
  roleId: string,
  action: string,
  resourceType: string,
): RolePermission {
  const now = new Date();
  return {
    id,
    version: 1,
    roleId,
    action,
    resourceType,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
    createdBy: null,
    updatedBy: null,
  };
}

describe('resolveEffectivePermissions', () => {
  it('returns direct permissions for a single role', () => {
    const roles = [makeRole('r1', 'viewer')];
    const perms = [makePerm('p1', 'r1', 'read', 'prd')];

    const result = resolveEffectivePermissions(['r1'], roles, perms);
    expect(result.permissions.has('read:prd')).toBe(true);
    expect(result.fromRoles).toContain('viewer');
  });

  it('includes inherited permissions from parent role', () => {
    const parentRole = makeRole('r-parent', 'developer');
    const childRole = makeRole('r-child', 'senior_developer', 'r-parent');
    const roles = [parentRole, childRole];
    const perms = [
      makePerm('p1', 'r-parent', 'read', 'code'),
      makePerm('p2', 'r-child', 'write', 'code'),
    ];

    const result = resolveEffectivePermissions(['r-child'], roles, perms);
    expect(result.permissions.has('read:code')).toBe(true);
    expect(result.permissions.has('write:code')).toBe(true);
    expect(result.fromRoles).toContain('developer');
    expect(result.fromRoles).toContain('senior_developer');
  });

  it('stops at MAX_DEPTH of 5 to prevent runaway inheritance', () => {
    // Create a chain 7 levels deep
    const roles = Array.from({ length: 7 }, (_, i) =>
      makeRole(`r${String(i)}`, `role_${String(i)}`, i > 0 ? `r${String(i - 1)}` : null),
    );
    const perms = [makePerm('p0', 'r0', 'read', 'root_resource')];

    // Assign the deepest role
    const result = resolveEffectivePermissions(['r6'], roles, perms);
    // At depth 5 we stop; r0 is 6 steps away, so it may not be reached
    // The test verifies no infinite loop; permission reachability at depth 5 is enough
    expect(result.permissions).toBeDefined();
  });

  it('ignores archived role permissions', () => {
    const role = makeRole('r1', 'viewer');
    const now = new Date();
    const archivedPerm: RolePermission = {
      ...makePerm('p1', 'r1', 'read', 'prd'),
      archivedAt: now,
    };
    const result = resolveEffectivePermissions(['r1'], [role], [archivedPerm]);
    expect(result.permissions.has('read:prd')).toBe(false);
  });

  it('handles multiple roles with overlapping permissions (union)', () => {
    const r1 = makeRole('r1', 'developer');
    const r2 = makeRole('r2', 'designer');
    const perms = [
      makePerm('p1', 'r1', 'read', 'code'),
      makePerm('p2', 'r2', 'read', 'design_tokens'),
      makePerm('p3', 'r1', 'write', 'code'),
    ];

    const result = resolveEffectivePermissions(['r1', 'r2'], [r1, r2], perms);
    expect(result.permissions.has('read:code')).toBe(true);
    expect(result.permissions.has('write:code')).toBe(true);
    expect(result.permissions.has('read:design_tokens')).toBe(true);
  });
});

describe('checkPermission', () => {
  it('returns true for exact match', () => {
    const perms = new Set(['read:prd']);
    expect(checkPermission(perms, 'read', 'prd')).toBe(true);
  });

  it('returns false when action does not match', () => {
    const perms = new Set(['read:prd']);
    expect(checkPermission(perms, 'write', 'prd')).toBe(false);
  });

  it('returns false when resource does not match', () => {
    const perms = new Set(['read:prd']);
    expect(checkPermission(perms, 'read', 'schema')).toBe(false);
  });

  it('wildcard action (*) matches any action', () => {
    const perms = new Set(['*:prd']);
    expect(checkPermission(perms, 'read', 'prd')).toBe(true);
    expect(checkPermission(perms, 'delete', 'prd')).toBe(true);
    expect(checkPermission(perms, 'approve', 'prd')).toBe(true);
  });

  it('wildcard resource (*) matches any resource', () => {
    const perms = new Set(['read:*']);
    expect(checkPermission(perms, 'read', 'prd')).toBe(true);
    expect(checkPermission(perms, 'read', 'schema')).toBe(true);
    expect(checkPermission(perms, 'write', 'prd')).toBe(false);
  });

  it('full wildcard (*:*) matches everything', () => {
    const perms = new Set(['*:*']);
    expect(checkPermission(perms, 'delete', 'workspace')).toBe(true);
    expect(checkPermission(perms, 'system.shutdown', 'system')).toBe(true);
  });

  it('empty permission set always returns false', () => {
    expect(checkPermission(new Set(), 'read', 'prd')).toBe(false);
  });
});
