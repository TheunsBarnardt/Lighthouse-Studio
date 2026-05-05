import type { NextRequest } from 'next/server';

import { NextResponse } from 'next/server';

import { verifySessionFromRequest } from '@/lib/server/session';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await verifySessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Not authenticated.', statusCode: 401 }, { status: 401 });
  }

  const body = (await request.json()) as { newEmail: string };
  if (!body.newEmail) {
    return NextResponse.json({ code: 'BAD_REQUEST', message: 'newEmail is required.', statusCode: 400 }, { status: 400 });
  }

  // TODO: AuthService.requestEmailChange(session.userId, body.newEmail)
  return NextResponse.json({ message: 'Verification email sent. Check your new inbox to confirm the change.' });
}
