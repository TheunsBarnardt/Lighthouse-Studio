import { z } from 'zod';

// ── Scalar ────────────────────────────────────────────────────────────────────

export type MetadataValue = string | number | boolean | null | MetadataObject | MetadataValue[];
export interface MetadataObject {
  [key: string]: MetadataValue;
}

export type ExportFormat = 'jsonl' | 'csv' | 'cef' | 'leef';

export type AuditOutcome = 'success' | 'failure' | 'denied';

export type ActorKind = 'user' | 'service_account' | 'system';

// ── Input (caller supplies; adapter computes hash/sequence) ───────────────────

export interface AuditActor {
  kind: ActorKind;
  /** null for fully system-initiated events */
  id: string | null;
  identityProvider?: string;
  /** Captured at event time; may not match the current value. */
  email?: string;
}

export interface AuditResource {
  type: string;
  id: string;
}

export interface AuditEntryInput {
  /** Canonical dotted event name, e.g. 'workspace.updated', 'auth.signin.succeeded'. */
  eventType: string;
  /** Null for installation-scoped events. */
  workspaceId?: string;
  actor: AuditActor;
  resource: AuditResource;
  /** Semantic verb — the last segment of eventType (e.g. 'updated', 'removed'). */
  action: string;
  outcome: AuditOutcome;
  reason?: string;
  metadata?: Record<string, MetadataValue>;
  ipAddress?: string;
  userAgent?: string;
  correlationId: string;
}

// ── Persisted entry (includes hash chain fields added by the adapter) ─────────

export interface AuditEntry extends AuditEntryInput {
  id: string;
  /** Per-workspace monotonic counter; installation chain uses workspace_id = null. */
  sequence: number;
  occurredAt: Date;
  /** SHA-256 hex hash of the previous event in this workspace's chain. */
  prevHash: string;
  /** SHA-256 hex hash of this event's canonical fields + prevHash. */
  hash: string;
}

// ── Query ─────────────────────────────────────────────────────────────────────

export interface AuditFilter {
  /** Omit only if the caller holds installation_auditor. */
  workspaceId?: string;
  eventType?: string | string[];
  actorId?: string;
  resourceType?: string;
  resourceId?: string;
  action?: string;
  outcome?: AuditOutcome;
  occurredAfter?: Date;
  occurredBefore?: Date;
  correlationId?: string;
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

// ── Hash-chain verification ───────────────────────────────────────────────────

export interface ChainVerification {
  workspaceId: string | null;
  verifiedAt: Date;
  eventsVerified: number;
  status: 'intact' | 'tampered';
  tamperedAt?: {
    sequence: number;
    expectedHash: string;
    actualHash: string;
  };
}

// ── Data-subject rights ───────────────────────────────────────────────────────

export interface DataSubjectExportJob {
  jobId: string;
  userId: string;
  requestedAt: Date;
  status: 'pending' | 'processing' | 'ready' | 'expired';
  downloadUrl?: string;
  expiresAt?: Date;
}

export interface ErasureOptions {
  /** Override grace period (in days). Defaults to installation setting (30). */
  gracePeriodDays?: number;
  /** Legal hold prevents erasure; must be explicitly released first. */
  reason?: string;
}

export interface ErasureJob {
  jobId: string;
  userId: string;
  requestedAt: Date;
  gracePeriodEndsAt: Date;
  status: 'pending' | 'processing' | 'completed' | 'blocked_by_legal_hold';
}

// ── Zod schemas ───────────────────────────────────────────────────────────────

export const AuditEntryInputSchema = z.object({
  eventType: z.string().min(1),
  workspaceId: z.string().optional(),
  actor: z.object({
    kind: z.enum(['user', 'service_account', 'system']),
    id: z.string().nullable(),
    identityProvider: z.string().optional(),
    email: z.string().optional(),
  }),
  resource: z.object({
    type: z.string().min(1),
    id: z.string().min(1),
  }),
  action: z.string().min(1),
  outcome: z.enum(['success', 'failure', 'denied']),
  reason: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  correlationId: z.string().min(1),
});
