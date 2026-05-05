import type { NextRequest } from 'next/server';

import { NextResponse } from 'next/server';

import { getUserDirectory } from '@/lib/server/auth-service';
import { verifySessionFromRequest } from '@/lib/server/session';

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const session = await verifySessionFromRequest(request);
  if (!session) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: 'Not authenticated.', statusCode: 401 },
      { status: 401 },
    );
  }

  const body = (await request.json()) as { displayName?: string };
  if (body.displayName !== undefined) {
    const directory = getUserDirectory();
    const result = await directory.updateProfile(session.userId, {
      displayName: body.displayName,
    });
    if (result.isErr()) {
      return NextResponse.json(
        { code: 'INTERNAL_ERROR', message: 'Failed to update profile', statusCode: 500 },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ message: 'Profile updated.' });
}
