import { NextResponse } from 'next/server';

import { okResponse } from '@/lib/server/api-helpers';
import { getSessionAdapter } from '@/lib/server/auth-service';
import { verifySessionFromRequest } from '@/lib/server/session';

export async function GET(request: Request): Promise<NextResponse> {
  const session = await verifySessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Not authenticated.', statusCode: 401 }, { status: 401 });
  }

  const sessions = getSessionAdapter();
  const result = await sessions.listForUser(session.userId);
  if (result.isErr()) {
    return NextResponse.json({ code: 'INTERNAL', message: 'Failed to list sessions.', statusCode: 500 }, { status: 500 });
  }

  const sessionList = result.value.map((s) => ({
    id: s.id,
    ipAddress: s.ipAddress,
    userAgent: s.userAgent,
    createdAt: s.createdAt.toISOString(),
    lastSeenAt: s.lastSeenAt.toISOString(),
    expiresAt: s.expiresAt.toISOString(),
    isCurrent: s.id === session.id,
  }));

  return okResponse(sessionList);
}

export async function DELETE(request: Request): Promise<NextResponse> {
  const session = await verifySessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Not authenticated.', statusCode: 401 }, { status: 401 });
  }

  const sessions = getSessionAdapter();
  await sessions.revokeAllForUser(session.userId);

  const response = NextResponse.json({ message: 'All sessions revoked.' });
  // Clear the current session cookie too
  response.cookies.set('lh_session', '', { httpOnly: true, maxAge: 0, path: '/' });
  return response;
}
