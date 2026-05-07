export const INTENT_CAPTURE_AUDIT_EVENTS = {
  CONVERSATION_STARTED: 'ai.intent_capture.conversation_started',
  MESSAGE_SENT: 'ai.intent_capture.message_sent',
  BRIEF_DRAFT_UPDATED: 'ai.intent_capture.brief_draft_updated',
  BRIEF_GENERATED: 'ai.intent_capture.brief_generated',
  BRIEF_EDITED: 'ai.intent_capture.brief_edited',
  BRIEF_SUBMITTED: 'ai.intent_capture.brief_submitted',
  BRIEF_APPROVED: 'ai.intent_capture.brief_approved',
  BRIEF_REJECTED: 'ai.intent_capture.brief_rejected',
  CONVERSATION_EXPIRED: 'ai.intent_capture.conversation_expired',
} as const;

export type IntentCaptureAuditEventType =
  (typeof INTENT_CAPTURE_AUDIT_EVENTS)[keyof typeof INTENT_CAPTURE_AUDIT_EVENTS];
