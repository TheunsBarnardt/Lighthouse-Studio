/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unnecessary-condition -- in-memory adapter types unresolved until packages rebuilt */
import { NextResponse } from 'next/server';

import { okResponse } from '@/lib/server/api-helpers';
import { getUserDirectory } from '@/lib/server/auth-service';
import { verifySessionFromRequest } from '@/lib/server/session';

export async function DELETE(request: Request): Promise<NextResponse> {
  const session = await verifySessionFromRequest(request);
  if (!session) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: 'Not authenticated.', statusCode: 401 },
      { status: 401 },
    );
  }

  // TODO: AccountService.deleteAccount(session.userId, ctx) — sends confirmation email in real impl
  const directory = getUserDirectory();
  try {
    await directory.remove(session.userId);
  } catch {
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to delete account', statusCode: 500 },
      { status: 500 },
    );
  }
  return NextResponse.json({ message: 'Account deleted.' });
}

export async function GET(request: Request): Promise<NextResponse> {
  const session = await verifySessionFromRequest(request);
  if (!session) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: 'Not authenticated.', statusCode: 401 },
      { status: 401 },
    );
  }

  const directory = getUserDirectory();
  let user;
  try {
    const userResult = await directory.findById(session.userId);
    if (!userResult) {
      return NextResponse.json(
        { code: 'NOT_FOUND', message: 'User not found.', statusCode: 404 },
        { status: 404 },
      );
    }
    user = userResult;
  } catch {
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to fetch user', statusCode: 500 },
      { status: 500 },
    );
  }
  return okResponse({
    id: user.id,
    email: user.primaryEmail,
    displayName: user.displayName,
    status: user.status,
    mfaEnabled: user.mfaEnabled,
    identities: user.identities.map((i) => ({
      providerId: i.providerId,
      email: i.email,
      primary: i.primary,
    })),
    preferences: user.preferences,
    avatarUrl: null,
  });
}
