/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unnecessary-condition -- in-memory adapter types unresolved until packages rebuilt */
import type { NextRequest } from 'next/server';

import { NextResponse } from 'next/server';

import { okResponse } from '@/lib/server/api-helpers';
import { getAuditAdapter, getUserDirectory } from '@/lib/server/auth-service';
import { verifySessionFromRequest } from '@/lib/server/session';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
): Promise<NextResponse> {
  const { userId } = await params;
  const session = await verifySessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Not authenticated.', statusCode: 401 }, { status: 401 });
  }

  const directory = getUserDirectory();
  let user;
  try {
    user = await directory.findById(userId);
  } catch {
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Failed to fetch user', statusCode: 500 }, { status: 500 });
  }
  if (!user) {
    return NextResponse.json({ code: 'NOT_FOUND', message: 'User not found.', statusCode: 404 }, { status: 404 });
  }

  return okResponse({
    id: user.id,
    email: user.primaryEmail || user.email,
    displayName: user.displayName || null,
    status: user.status,
    mfaEnabled: user.mfaEnabled || false,
    roles: user.roles || [],
    identities: user.identities || [],
    createdAt: user.createdAt,
    lastSignIn: user.lastSignIn || null,
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
): Promise<NextResponse> {
  const { userId } = await params;
  const session = await verifySessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Not authenticated.', statusCode: 401 }, { status: 401 });
  }

  const body = (await request.json()) as { status?: string; mfaEnabled?: boolean };
  const directory = getUserDirectory();
  const updates: Record<string, unknown> = {};
  if (body.status !== undefined) updates['status'] = body.status;
  if (body.mfaEnabled !== undefined) updates['mfaEnabled'] = body.mfaEnabled;

  try {
    await directory.update(userId, updates);
  } catch {
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Failed to update user', statusCode: 500 }, { status: 500 });
  }

  // Audit MFA admin reset — per spec, always at info level.
  if (body.mfaEnabled === false) {
    await getAuditAdapter().write({
      eventType: 'data_management.installation.mfa_admin_reset',
      actor: { type: 'user', id: session.userId, email: session.email ?? undefined },
      resource: { type: 'user', id: userId },
      action: 'mfa_admin_reset',
      outcome: 'success',
      severity: 'info',
      metadata: { targetUserId: userId },
    });
  }

  return okResponse({ message: 'User updated.' });
}
