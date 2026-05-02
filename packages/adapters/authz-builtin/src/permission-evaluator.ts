import type { RolePermission, WorkspaceRole } from '@platform/ports-authorization';

import { permissionGrantsAction } from './built-in-roles.js';

interface ResolvedPermissions {
  permissions: Set<string>;
  fromRoles: string[];
}

/**
 * Walk the role hierarchy (up to MAX_DEPTH levels) collecting all permissions.
 *
 * @param directRoleIds - IDs of roles directly assigned to the member
 * @param roles - all workspace roles (built-in + custom)
 * @param rolePermissions - all role_permission rows
 */
export function resolveEffectivePermissions(
  directRoleIds: string[],
  roles: WorkspaceRole[],
  rolePermissions: RolePermission[],
): ResolvedPermissions {
  const MAX_DEPTH = 5;
  const visitedRoleIds = new Set<string>();
  const queue: Array<{ id: string; depth: number }> = directRoleIds.map((id) => ({
    id,
    depth: 0,
  }));

  while (queue.length > 0) {
    const item = queue.shift();
    if (!item || visitedRoleIds.has(item.id) || item.depth > MAX_DEPTH) continue;
    visitedRoleIds.add(item.id);

    const role = roles.find((r) => r.id === item.id && !r.archivedAt);
    if (!role) continue;

    if (role.parentRoleId && !visitedRoleIds.has(role.parentRoleId)) {
      queue.push({ id: role.parentRoleId, depth: item.depth + 1 });
    }
  }

  const permissions = new Set<string>();
  const fromRoles: string[] = [];

  for (const roleId of visitedRoleIds) {
    const role = roles.find((r) => r.id === roleId);
    if (role) fromRoles.push(role.name);

    for (const rp of rolePermissions) {
      if (rp.roleId === roleId && !rp.archivedAt) {
        permissions.add(`${rp.action}:${rp.resourceType}`);
      }
    }
  }

  return { permissions, fromRoles };
}

/**
 * Check whether a set of resolved permissions grants the requested action+resource.
 * Handles wildcards stored as `*:*`, `read:*`, `*:workspace`, etc.
 */
export function checkPermission(
  permissions: Set<string>,
  action: string,
  resourceType: string,
): boolean {
  for (const perm of permissions) {
    const [permAction, permResource] = perm.split(':') as [string, string | undefined];
    if (!permResource) continue;
    if (
      permissionGrantsAction(
        { action: permAction, resourceType: permResource },
        action,
        resourceType,
      )
    ) {
      return true;
    }
  }
  return false;
}
