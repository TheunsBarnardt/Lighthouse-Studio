import type { NextRequest } from 'next/server';

import { NextResponse } from 'next/server';

import { verifySessionFromRequest } from '@/lib/server/session';
import { getUserDirectory } from '@/lib/server/auth-service';

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const session = await verifySessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Not authenticated.', statusCode: 401 }, { status: 401 });
  }

  const body = (await request.json()) as { displayName?: string };
  if (body.displayName !== undefined) {
    const directory = getUserDirectory();
    try {
      await directory.update(session.userId, { displayName: body.displayName });
    } catch {
      return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Failed to update profile', statusCode: 500 }, { status: 500 });
    }
  }

  return NextResponse.json({ message: 'Profile updated.' });
}
