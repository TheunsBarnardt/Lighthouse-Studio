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

  const directory = getUserDirectory();
  const archiveResult = await directory.archive(session.userId);
  if (archiveResult.isErr()) {
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
  const userResult = await directory.findById(session.userId);
  if (userResult.isErr()) {
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to fetch user', statusCode: 500 },
      { status: 500 },
    );
  }
  const user = userResult.value;
  if (!user) {
    return NextResponse.json(
      { code: 'NOT_FOUND', message: 'User not found.', statusCode: 404 },
      { status: 404 },
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
