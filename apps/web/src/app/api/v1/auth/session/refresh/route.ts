import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSessionAdapter } from '@/lib/server/auth-service';
import { setSessionCookie } from '@/lib/server/session';

const RefreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { code: 'VALIDATION', message: 'Invalid JSON', statusCode: 400 },
      { status: 400 },
    );
  }

  const parsed = RefreshSchema.safeParse(body);
  if (!parsed.success) {
    // Missing/empty token is an auth failure, not a validation error
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: 'No refresh token provided', statusCode: 401 },
      { status: 401 },
    );
  }

  const sessions = getSessionAdapter();
  const refreshResult = await sessions.refresh(parsed.data.refreshToken);
  if (refreshResult.isErr()) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: 'Invalid or expired token', statusCode: 401 },
      { status: 401 },
    );
  }

  const { session, newToken } = refreshResult.value;
  if (!newToken) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: 'Invalid or expired token', statusCode: 401 },
      { status: 401 },
    );
  }

  // Return just the Session object — SDK refreshSession() expects this format
  const response = NextResponse.json({
    accessToken: newToken,
    refreshToken: newToken,
    expiresAt: session.expiresAt.getTime(),
    userId: session.userId,
    workspaceId: session.workspaceId ?? '',
  });

  setSessionCookie(response, newToken);
  return response;
}
