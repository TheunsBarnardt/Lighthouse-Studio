import type { NextRequest } from 'next/server';

import { NextResponse } from 'next/server';

import { verifySessionFromRequest } from '@/lib/server/session';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await verifySessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Not authenticated.', statusCode: 401 }, { status: 401 });
  }

  const body = (await request.json()) as { currentPassword: string; newPassword: string };
  if (!body.currentPassword || !body.newPassword) {
    return NextResponse.json({ code: 'BAD_REQUEST', message: 'currentPassword and newPassword are required.', statusCode: 400 }, { status: 400 });
  }

  // TODO: AuthService.changePassword(session.userId, body.currentPassword, body.newPassword)
  return NextResponse.json({ message: 'Password changed.' });
}
