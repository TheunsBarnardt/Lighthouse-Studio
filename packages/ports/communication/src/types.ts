import { z } from 'zod';

export interface EmailAddress {
  email: string;
  name?: string;
}

export interface EmailMessage {
  from: EmailAddress;
  to: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  replyTo?: EmailAddress;
  subject: string;
  bodyHtml?: string;
  bodyText?: string;
  attachments?: EmailAttachment[];
  headers?: Record<string, string>;
}

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType: string;
}

export interface EmailSendResult {
  messageId: string;
  accepted: string[];
  rejected: string[];
}

export interface SmsMessage {
  to: string;
  body: string;
  from?: string;
}

export interface SmsSendResult {
  messageId: string;
  status: 'queued' | 'sent' | 'failed';
}

export interface PushNotification {
  tokens: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
  badge?: number;
}

export interface PushSendResult {
  successCount: number;
  failureCount: number;
  results: Array<{ token: string; success: boolean; error?: string }>;
}

export const EmailMessageSchema = z.object({
  from: z.object({ email: z.string().email(), name: z.string().optional() }),
  to: z.array(z.object({ email: z.string().email(), name: z.string().optional() })).min(1),
  subject: z.string().min(1),
  bodyHtml: z.string().optional(),
  bodyText: z.string().optional(),
});
