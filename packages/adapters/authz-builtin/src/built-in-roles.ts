/**
 * Built-in role definitions for the platform.
 *
 * These are seeded once on first install and are immutable at runtime.
 * Custom roles extend these; they cannot modify or delete them.
 *
 * Wildcard '*' matches any resource or action during evaluation.
 */

export interface BuiltInRoleDefinition {
  name: string;
  description: string;
  /** Installation-level (no workspaceId) vs workspace-level. */
  scope: 'installation' | 'workspace';
  permissions: Array<{ action: string; resourceType: string }>;
}

function perms(
  ...entries: Array<[action: string, resource: string]>
): Array<{ action: string; resourceType: string }> {
  return entries.map(([action, resourceType]) => ({ action, resourceType }));
}

export const BUILT_IN_ROLES: BuiltInRoleDefinition[] = [
  // ── Installation-level ────────────────────────────────────────────────────
  {
    name: 'installation_owner',
    description: 'Full access across the installation',
    scope: 'installation',
    permissions: perms(['*', '*']),
  },
  {
    name: 'installation_admin',
    description: 'Operational administration — manage workspaces and users',
    scope: 'installation',
    permissions: perms(['*', 'workspace'], ['*', 'member'], ['*', 'user'], ['read', 'system']),
  },
  {
    name: 'installation_auditor',
    description: 'Read-only access to audit logs across all workspaces',
    scope: 'installation',
    permissions: perms(['read', 'audit'], ['read', 'workspace']),
  },

  // ── Workspace-level ───────────────────────────────────────────────────────
  {
    name: 'workspace_owner',
    description: 'Full access to a workspace',
    scope: 'workspace',
    permissions: perms(
      ['*', 'workspace'],
      ['*', 'member'],
      ['*', 'role'],
      ['*', 'invitation'],
      ['*', 'intent_brief'],
      ['*', 'prd'],
      ['*', 'brd'],
      ['*', 'design_tokens'],
      ['*', 'prototype'],
      ['*', 'schema'],
      ['*', 'ui'],
      ['*', 'code'],
      ['*', 'test'],
      ['*', 'deploy'],
      ['*', 'artifact'],
      ['*', 'approval'],
      ['*', 'data_table'],
      ['*', 'data_row'],
    ),
  },
  {
    name: 'workspace_admin',
    description: 'Manage workspace settings and members',
    scope: 'workspace',
    permissions: perms(
      ['read', 'workspace'],
      ['update', 'workspace'],
      ['*', 'member'],
      ['*', 'role'],
      ['*', 'invitation'],
      // Schema management — admins can do everything except schema deploy requires architect approval
      ['schema.create', 'schema'],
      ['schema.read', 'schema'],
      ['schema.update', 'schema'],
      ['schema.delete', 'schema'],
      ['schema.deploy', 'schema'],
      ['schema.rollback', 'schema'],
      ['schema.export', 'schema'],
      ['schema.import', 'schema'],
      // Data management — full access to tables and rows
      ['*', 'data_table'],
      ['*', 'data_row'],
    ),
  },
  {
    name: 'business_analyst',
    description: 'Owns requirements and approvals at the requirements stage',
    scope: 'workspace',
    permissions: perms(
      ['*', 'intent_brief'],
      ['*', 'prd'],
      ['*', 'brd'],
      ['grant', 'approval.requirements'],
    ),
  },
  {
    name: 'designer',
    description: 'Owns design tokens and prototype stages',
    scope: 'workspace',
    permissions: perms(['*', 'design_tokens'], ['*', 'prototype'], ['grant', 'approval.design']),
  },
  {
    name: 'architect',
    description: 'Owns schema and architecture decisions',
    scope: 'workspace',
    permissions: perms(
      ['*', 'schema'],
      ['grant', 'approval.architecture'],
      ['read', 'data_table'],
      ['read', 'data_row'],
    ),
  },
  {
    name: 'developer',
    description: 'Builds features',
    scope: 'workspace',
    permissions: perms(
      ['*', 'ui'],
      ['*', 'code'],
      ['read', 'intent_brief'],
      ['read', 'prd'],
      ['read', 'brd'],
      ['read', 'design_tokens'],
      ['read', 'schema'],
      ['schema.read', 'schema'],
      ['schema.export', 'schema'],
      // Developers can read and write customer data rows (needed for testing/development)
      ['read', 'data_table'],
      ['create', 'data_row'],
      ['read', 'data_row'],
      ['update', 'data_row'],
      ['delete', 'data_row'],
    ),
  },
  {
    name: 'qa',
    description: 'Owns test definition and acceptance',
    scope: 'workspace',
    permissions: perms(
      ['*', 'test'],
      ['grant', 'approval.qa'],
      ['schema.read', 'schema'],
      ['schema.export', 'schema'],
      ['read', 'data_table'],
      ['read', 'data_row'],
    ),
  },
  {
    name: 'ops',
    description: 'Owns deployment and infrastructure',
    scope: 'workspace',
    permissions: perms(['*', 'deploy'], ['grant', 'approval.deploy']),
  },
  {
    name: 'reviewer',
    description: 'Read everything; approve where explicitly assigned',
    scope: 'workspace',
    permissions: perms(
      ['read', 'intent_brief'],
      ['read', 'prd'],
      ['read', 'brd'],
      ['read', 'design_tokens'],
      ['read', 'schema'],
      ['read', 'ui'],
      ['read', 'code'],
      ['read', 'test'],
      ['read', 'deploy'],
      ['read', 'workspace'],
      ['read', 'member'],
      ['schema.read', 'schema'],
      ['schema.export', 'schema'],
      ['read', 'data_table'],
      ['read', 'data_row'],
    ),
  },
  {
    name: 'viewer',
    description: 'Read-only access to workspace resources',
    scope: 'workspace',
    permissions: perms(
      ['read', 'intent_brief'],
      ['read', 'prd'],
      ['read', 'brd'],
      ['read', 'design_tokens'],
      ['read', 'schema'],
      ['read', 'ui'],
      ['read', 'code'],
      ['read', 'test'],
      ['read', 'deploy'],
      ['read', 'workspace'],
      ['schema.read', 'schema'],
      ['schema.export', 'schema'],
      ['read', 'data_table'],
      ['read', 'data_row'],
    ),
  },
];

/**
 * Expand a wildcard permission into a check function.
 * Returns true if the permission grants the requested action+resource.
 */
export function permissionGrantsAction(
  perm: { action: string; resourceType: string },
  action: string,
  resourceType: string,
): boolean {
  const actionMatch = perm.action === '*' || perm.action === action;
  const resourceMatch = perm.resourceType === '*' || perm.resourceType === resourceType;
  return actionMatch && resourceMatch;
}
