import { NextResponse } from 'next/server';

import { clearSessionCookie, verifySessionFromRequest } from '@/lib/server/session';
import { getSessionAdapter } from '@/lib/server/auth-service';

export async function POST(request: Request): Promise<NextResponse> {
  const session = await verifySessionFromRequest(request);

  if (session) {
    const sessions = getSessionAdapter();
    await sessions.revoke(session.id);
  }

  const response = NextResponse.json({ message: 'Signed out.' }, { status: 200 });
  clearSessionCookie(response);
  return response;
}
