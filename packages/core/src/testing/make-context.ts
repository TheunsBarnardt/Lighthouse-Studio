import type { RequestContext, SystemContext } from '@platform/ports-authorization';

import { randomUUID } from 'node:crypto';

import { makeSystemContext as _makeSystemContext } from '../context.js';

export type { SystemContext };

/**
 * Build a RequestContext for unit tests. All fields have sensible defaults.
 */
export function makeUserContext(
  opts: {
    userId?: string;
    workspaceId?: string;
    installationRoles?: RequestContext['installationRoles'];
    correlationId?: string;
    mfaSatisfied?: boolean;
    ipAddress?: string;
    userAgent?: string;
    idempotencyKey?: string;
  } = {},
): RequestContext {
  // Build as a plain object; cast to RequestContext at the end.
  // We cannot use Partial<RequestContext> with readonly fields + exactOptionalPropertyTypes,
  // so we construct the shape directly and cast.
  const ctx: Record<string, unknown> = {
    _kind: 'user',
    userId: opts.userId ?? 'user-test-1',
    installationRoles: opts.installationRoles ?? [],
    correlationId: opts.correlationId ?? randomUUID(),
    mfaSatisfied: opts.mfaSatisfied ?? false,
  };

  if (opts.workspaceId !== undefined) ctx['workspaceId'] = opts.workspaceId;
  if (opts.ipAddress !== undefined) ctx['ipAddress'] = opts.ipAddress;
  if (opts.userAgent !== undefined) ctx['userAgent'] = opts.userAgent;
  if (opts.idempotencyKey !== undefined) ctx['idempotencyKey'] = opts.idempotencyKey;

  return ctx as unknown as RequestContext;
}

export { _makeSystemContext as makeSystemContext };
