/**
 * PRD permissions — Objective 22, Section 6.8
 */

export const PRD_PERMISSIONS = {
  CREATE: 'ai.prd.create',
  READ: 'ai.prd.read',
  EDIT: 'ai.prd.edit',
  APPROVE: 'ai.prd.approve',
  EXPORT: 'ai.prd.export',
  DELETE: 'ai.prd.delete',
} as const;

export type PrdPermission = (typeof PRD_PERMISSIONS)[keyof typeof PRD_PERMISSIONS];

/**
 * Default role → permission grants.
 * Applied at workspace role setup; overridable per workspace.
 */
export const PRD_DEFAULT_ROLE_GRANTS: Record<string, PrdPermission[]> = {
  workspace_owner: [
    PRD_PERMISSIONS.CREATE,
    PRD_PERMISSIONS.READ,
    PRD_PERMISSIONS.EDIT,
    PRD_PERMISSIONS.APPROVE,
    PRD_PERMISSIONS.EXPORT,
    PRD_PERMISSIONS.DELETE,
  ],
  workspace_admin: [
    PRD_PERMISSIONS.CREATE,
    PRD_PERMISSIONS.READ,
    PRD_PERMISSIONS.EDIT,
    PRD_PERMISSIONS.APPROVE,
    PRD_PERMISSIONS.EXPORT,
    PRD_PERMISSIONS.DELETE,
  ],
  business_analyst: [
    PRD_PERMISSIONS.CREATE,
    PRD_PERMISSIONS.READ,
    PRD_PERMISSIONS.EDIT,
    PRD_PERMISSIONS.APPROVE,
    PRD_PERMISSIONS.EXPORT,
  ],
  architect: [
    PRD_PERMISSIONS.READ,
    PRD_PERMISSIONS.EDIT,
    PRD_PERMISSIONS.APPROVE,
    PRD_PERMISSIONS.EXPORT,
  ],
  developer: [PRD_PERMISSIONS.READ, PRD_PERMISSIONS.EXPORT],
  qa: [PRD_PERMISSIONS.READ, PRD_PERMISSIONS.EXPORT],
  reviewer: [PRD_PERMISSIONS.READ, PRD_PERMISSIONS.EXPORT],
  viewer: [PRD_PERMISSIONS.READ, PRD_PERMISSIONS.EXPORT],
};
