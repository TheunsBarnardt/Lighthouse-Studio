export const PRD_GENERATION_PERMISSIONS = {
  CREATE: 'ai.prd.create',
  READ: 'ai.prd.read',
  EDIT: 'ai.prd.edit',
  APPROVE: 'ai.prd.approve',
  EXPORT: 'ai.prd.export',
  DELETE: 'ai.prd.delete',
} as const;

export type PrdGenerationPermission =
  (typeof PRD_GENERATION_PERMISSIONS)[keyof typeof PRD_GENERATION_PERMISSIONS];

const { CREATE, READ, EDIT, APPROVE, EXPORT, DELETE } = PRD_GENERATION_PERMISSIONS;

export const PRD_GENERATION_ROLE_GRANTS: Record<string, PrdGenerationPermission[]> = {
  workspace_owner: [CREATE, READ, EDIT, APPROVE, EXPORT, DELETE],
  workspace_admin: [CREATE, READ, EDIT, APPROVE, EXPORT, DELETE],
  business_analyst: [CREATE, READ, EDIT, APPROVE, EXPORT],
  architect: [READ, EDIT, APPROVE, EXPORT],
  developer: [READ, EXPORT],
  qa: [READ, EXPORT],
  reviewer: [READ, EXPORT],
  viewer: [READ, EXPORT],
};
