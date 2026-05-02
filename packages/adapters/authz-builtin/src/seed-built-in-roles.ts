import type { RolePermission, WorkspaceRole } from '@platform/ports-authorization';
import type { LoggerPort } from '@platform/ports-observability';
import type { RepositoryPort } from '@platform/ports-persistence';

import { uuidv7 } from 'uuidv7';

import { BUILT_IN_ROLES } from './built-in-roles.js';

type RoleRepo = RepositoryPort<WorkspaceRole>;
type RolePermRepo = RepositoryPort<RolePermission>;

/**
 * Idempotently seeds the built-in roles and their permissions.
 * Safe to call on every startup; roles that already exist are skipped.
 * Built-in roles cannot be modified after creation.
 */
export async function seedBuiltInRoles(
  roles: RoleRepo,
  rolePermissions: RolePermRepo,
  logger: LoggerPort,
): Promise<void> {
  for (const def of BUILT_IN_ROLES) {
    // Check if the built-in role already exists
    const existing = await roles.findOne({
      _and: [{ name: { _eq: def.name } }, { builtin: { _eq: true } }],
    } as Parameters<RoleRepo['findOne']>[0]);

    if (existing.isErr()) {
      logger.warn('Failed to query built-in role during seed', { name: def.name });
      continue;
    }

    let roleId: string;

    if (!existing.value) {
      // Create the role
      const now = new Date();
      const roleRecord: WorkspaceRole = {
        id: uuidv7(),
        version: 1,
        workspaceId: null,
        name: def.name,
        description: def.description,
        builtin: true,
        parentRoleId: null,
        archivedAt: null,
        createdAt: now,
        updatedAt: now,
        createdBy: null,
        updatedBy: null,
      };

      const createResult = await roles.create(roleRecord);
      if (createResult.isErr()) {
        logger.warn('Failed to seed built-in role', {
          name: def.name,
          error: createResult.error.message,
        });
        continue;
      }

      roleId = createResult.value.id;
      logger.info('Seeded built-in role', { name: def.name, id: roleId });
    } else {
      roleId = existing.value.id;
    }

    // Seed permissions for this role (idempotent)
    for (const perm of def.permissions) {
      const existingPerm = await rolePermissions.findOne({
        _and: [
          { roleId: { _eq: roleId } },
          { action: { _eq: perm.action } },
          { resourceType: { _eq: perm.resourceType } },
        ],
      } as Parameters<RolePermRepo['findOne']>[0]);

      if (existingPerm.isOk() && !existingPerm.value) {
        const now = new Date();
        const permRecord: RolePermission = {
          id: uuidv7(),
          version: 1,
          roleId,
          action: perm.action,
          resourceType: perm.resourceType,
          archivedAt: null,
          createdAt: now,
          updatedAt: now,
          createdBy: null,
          updatedBy: null,
        };
        await rolePermissions.create(permRecord);
      }
    }
  }
}
