import type { AuditActor, AuditEntryInput } from '@platform/ports-audit';
import type { RequestContext, SystemContext } from '@platform/ports-authorization';

import { randomUUID } from 'node:crypto';

// ── Factories ──────────────────────────────────────────────────────────────────

export function makeSystemContext(subsystem: string, correlationId?: string): SystemContext {
  return {
    _kind: 'system',
    subsystem,
    correlationId: correlationId ?? randomUUID(),
  };
}

export function requireWorkspaceId(ctx: RequestContext): string {
  if (!ctx.workspaceId) {
    throw new Error(
      'WorkspaceContextRequired: a workspaceId is required on the RequestContext for this operation',
    );
  }
  return ctx.workspaceId;
}

export function isInstallationOwner(ctx: RequestContext): boolean {
  return ctx.installationRoles.includes('installation_owner');
}

export function isInstallationAdmin(ctx: RequestContext): boolean {
  return (
    ctx.installationRoles.includes('installation_owner') ||
    ctx.installationRoles.includes('installation_admin')
  );
}

export function isInstallationAuditor(ctx: RequestContext): boolean {
  return (
    ctx.installationRoles.includes('installation_owner') ||
    ctx.installationRoles.includes('installation_admin') ||
    ctx.installationRoles.includes('installation_auditor')
  );
}

// ── Audit helpers ──────────────────────────────────────────────────────────────

/** Build the actor object for an audit entry from a RequestContext. */
export function toAuditActor(ctx: RequestContext): AuditActor {
  return {
    kind: ctx._kind,
    id: ctx.userId,
  };
}

/** Extracts optional request metadata for audit entries. */
export function auditMeta(ctx: RequestContext): Pick<AuditEntryInput, 'ipAddress' | 'userAgent'> {
  const meta: { ipAddress?: string; userAgent?: string } = {};
  if (ctx.ipAddress !== undefined) meta.ipAddress = ctx.ipAddress;
  if (ctx.userAgent !== undefined) meta.userAgent = ctx.userAgent;
  return meta;
}
