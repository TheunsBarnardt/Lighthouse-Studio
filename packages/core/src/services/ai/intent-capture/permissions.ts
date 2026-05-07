export const INTENT_CAPTURE_PERMISSIONS = {
  CREATE: 'ai.intent_capture.create',
  READ: 'ai.intent_capture.read',
  EDIT: 'ai.intent_capture.edit',
  DELETE: 'ai.intent_capture.delete',
  APPROVE: 'ai.intent_capture.approve',
} as const;

export type IntentCapturePermission =
  (typeof INTENT_CAPTURE_PERMISSIONS)[keyof typeof INTENT_CAPTURE_PERMISSIONS];

/** Default role grants for intent capture permissions. */
export const INTENT_CAPTURE_ROLE_GRANTS: Record<string, IntentCapturePermission[]> = {
  owner: [
    INTENT_CAPTURE_PERMISSIONS.CREATE,
    INTENT_CAPTURE_PERMISSIONS.READ,
    INTENT_CAPTURE_PERMISSIONS.EDIT,
    INTENT_CAPTURE_PERMISSIONS.DELETE,
    INTENT_CAPTURE_PERMISSIONS.APPROVE,
  ],
  admin: [
    INTENT_CAPTURE_PERMISSIONS.CREATE,
    INTENT_CAPTURE_PERMISSIONS.READ,
    INTENT_CAPTURE_PERMISSIONS.EDIT,
    INTENT_CAPTURE_PERMISSIONS.DELETE,
    INTENT_CAPTURE_PERMISSIONS.APPROVE,
  ],
  member: [
    INTENT_CAPTURE_PERMISSIONS.CREATE,
    INTENT_CAPTURE_PERMISSIONS.READ,
    INTENT_CAPTURE_PERMISSIONS.EDIT,
  ],
  viewer: [INTENT_CAPTURE_PERMISSIONS.READ],
};
