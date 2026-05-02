import type { AuditEntry } from '@platform/ports-audit';
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

/** Extracts optional request metadata for audit entries without violating exactOptionalPropertyTypes. */
export function auditMeta(ctx: RequestContext): Pick<AuditEntry, 'ipAddress' | 'userAgent'> {
  const meta: { ipAddress?: string; userAgent?: string } = {};
  if (ctx.ipAddress !== undefined) meta.ipAddress = ctx.ipAddress;
  if (ctx.userAgent !== undefined) meta.userAgent = ctx.userAgent;
  return meta;
}
