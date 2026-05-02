import { z } from 'zod';

export interface AuditEntry {
  id?: string;
  workspaceId: string;
  actorId: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  occurredAt: Date;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditFilter {
  workspaceId?: string;
  actorId?: string;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  from?: Date;
  to?: Date;
}

export interface AuditPage {
  limit: number;
  offset: number;
}

export interface PaginatedAuditResult {
  items: AuditEntry[];
  total: number;
  limit: number;
  offset: number;
}

export const AuditEntrySchema = z.object({
  workspaceId: z.string().min(1),
  actorId: z.string().nullable(),
  action: z.string().min(1),
  resourceType: z.string().min(1),
  resourceId: z.string().min(1),
  before: z.record(z.unknown()).optional(),
  after: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
  occurredAt: z.date(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
});
