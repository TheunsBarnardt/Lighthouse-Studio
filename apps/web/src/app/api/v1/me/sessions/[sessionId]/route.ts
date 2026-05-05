import type { NextRequest } from 'next/server';

import { NextResponse } from 'next/server';

import { okResponse } from '@/lib/server/api-helpers';
import { getSessionAdapter } from '@/lib/server/auth-service';
import { verifySessionFromRequest } from '@/lib/server/session';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
): Promise<NextResponse> {
  const session = await verifySessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Not authenticated.', statusCode: 401 }, { status: 401 });
  }

  const { sessionId } = await params;

  // Verify the session belongs to this user
  const sessions = getSessionAdapter();
  const allResult = await sessions.listForUser(session.userId);
  if (allResult.isErr()) {
    return NextResponse.json({ code: 'INTERNAL', message: 'Failed.', statusCode: 500 }, { status: 500 });
  }

  const belongs = allResult.value.some((s) => s.id === sessionId);
  if (!belongs) {
    return NextResponse.json({ code: 'FORBIDDEN', message: 'Cannot revoke this session.', statusCode: 403 }, { status: 403 });
  }

  await sessions.revoke(sessionId);

  const response = okResponse({ message: 'Session revoked.' });
  // If they revoked their own current session, clear the cookie
  if (sessionId === session.id) {
    response.cookies.set('lh_session', '', { httpOnly: true, maxAge: 0, path: '/' });
  }
  return response;
}
