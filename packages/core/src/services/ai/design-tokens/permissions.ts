export const DESIGN_TOKENS_PERMISSIONS = {
  CREATE: 'ai.design_tokens.create',
  READ: 'ai.design_tokens.read',
  EDIT: 'ai.design_tokens.edit',
  APPROVE: 'ai.design_tokens.approve',
  EXPORT: 'ai.design_tokens.export',
  DELETE: 'ai.design_tokens.delete',
} as const;

export const DESIGN_TOKENS_DEFAULT_GRANTS: Record<string, string[]> = {
  workspace_owner: Object.values(DESIGN_TOKENS_PERMISSIONS),
  workspace_admin: Object.values(DESIGN_TOKENS_PERMISSIONS),
  designer: Object.values(DESIGN_TOKENS_PERMISSIONS),
  business_analyst: [DESIGN_TOKENS_PERMISSIONS.READ, DESIGN_TOKENS_PERMISSIONS.APPROVE],
  architect: [DESIGN_TOKENS_PERMISSIONS.READ, DESIGN_TOKENS_PERMISSIONS.EXPORT],
  developer: [DESIGN_TOKENS_PERMISSIONS.READ, DESIGN_TOKENS_PERMISSIONS.EXPORT],
};
