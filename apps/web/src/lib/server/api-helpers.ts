import type { AppError } from '@platform/core';
import type { RequestContext } from '@platform/ports-authorization';

import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';

export function errorResponse(err: AppError): NextResponse {
  return NextResponse.json(
    { code: err.code, message: err.message, metadata: err.metadata },
    { status: err.statusCode },
  );
}

export function okResponse<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

/** Extracts a minimal RequestContext from incoming request headers. */
export function requestContext(workspaceId: string, request: Request): RequestContext {
  const ip =
    request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? undefined;
  const ua = request.headers.get('user-agent') ?? undefined;
  return {
    _kind: 'user',
    userId: request.headers.get('x-user-id') ?? 'anonymous',
    installationRoles: [],
    correlationId: request.headers.get('x-correlation-id') ?? randomUUID(),
    mfaSatisfied: false,
    workspaceId,
    ...(ip !== undefined && { ipAddress: ip }),
    ...(ua !== undefined && { userAgent: ua }),
  };
}
