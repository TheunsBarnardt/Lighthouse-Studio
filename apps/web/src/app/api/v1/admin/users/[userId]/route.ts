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
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: 'Not authenticated.', statusCode: 401 },
      { status: 401 },
    );
  }

  const directory = getUserDirectory();
  const userResult = await directory.findById(userId);
  if (userResult.isErr()) {
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to fetch user', statusCode: 500 },
      { status: 500 },
    );
  }
  if (!userResult.value) {
    return NextResponse.json(
      { code: 'NOT_FOUND', message: 'User not found.', statusCode: 404 },
      { status: 404 },
    );
  }
  const user = userResult.value;

  return okResponse({
    id: user.id,
    email: user.primaryEmail,
    displayName: user.displayName,
    status: user.status,
    mfaEnabled: user.mfaEnabled,
    identities: user.identities,
    createdAt: user.createdAt,
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
): Promise<NextResponse> {
  const { userId } = await params;
  const session = await verifySessionFromRequest(request);
  if (!session) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: 'Not authenticated.', statusCode: 401 },
      { status: 401 },
    );
  }

  const body = (await request.json()) as { status?: string; mfaEnabled?: boolean };
  const directory = getUserDirectory();

  // Handle status changes (archive/restore)
  if (body.status === 'archived') {
    const result = await directory.archive(userId);
    if (result.isErr()) {
      return NextResponse.json(
        { code: 'INTERNAL_ERROR', message: 'Failed to update user', statusCode: 500 },
        { status: 500 },
      );
    }
  } else if (body.status === 'active') {
    const result = await directory.restore(userId);
    if (result.isErr()) {
      return NextResponse.json(
        { code: 'INTERNAL_ERROR', message: 'Failed to update user', statusCode: 500 },
        { status: 500 },
      );
    }
  }

  // Audit MFA admin reset — per spec, always at info level.
  if (body.mfaEnabled === false) {
    await getAuditAdapter().write({
      eventType: 'data_management.installation.mfa_admin_reset',
      actor: { kind: 'user', id: session.userId },
      resource: { type: 'user', id: userId },
      action: 'mfa_admin_reset',
      outcome: 'success',
      correlationId: session.id,
      metadata: { targetUserId: userId },
    });
  }

  return okResponse({ message: 'User updated.' });
}
