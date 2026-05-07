import type { RowPermissions } from '../types.js';

export function useRowPermissions(row: Record<string, unknown>): RowPermissions {
  const perms = row['_permissions'] as
    | { canEdit?: boolean; canDelete?: boolean; redactedFields?: string[] }
    | undefined;

  return {
    canEdit: perms?.canEdit ?? false,
    canDelete: perms?.canDelete ?? false,
    redactedFields: new Set(perms?.redactedFields ?? []),
  };
}
