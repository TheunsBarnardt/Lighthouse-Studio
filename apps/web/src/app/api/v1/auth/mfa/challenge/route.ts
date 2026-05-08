import { NextResponse } from 'next/server';
import { z } from 'zod';

import { okResponse } from '@/lib/server/api-helpers';
import { getSessionAdapter, getUserDirectory } from '@/lib/server/auth-service';
import { setSessionCookie } from '@/lib/server/session';
import { verifyAndConsumeMfaChallenge } from '@/lib/server/two-factor';

const MfaChallengeSchema = z.object({
  challengeId: z.string().min(1),
  code: z.string().min(6).max(10),
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

  const parsed = MfaChallengeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { code: 'VALIDATION', message: 'Invalid input', statusCode: 400 },
      { status: 400 },
    );
  }

  const verification = verifyAndConsumeMfaChallenge(parsed.data.challengeId, parsed.data.code);
  if (!verification.valid || !verification.userId) {
    return NextResponse.json(
      { code: 'AUTHENTICATION_FAILED', message: 'Invalid or expired code.', statusCode: 401 },
      { status: 401 },
    );
  }

  const directory = getUserDirectory();
  const userResult = await directory.findById(verification.userId);
  if (userResult.isErr() || !userResult.value) {
    return NextResponse.json(
      { code: 'NOT_FOUND', message: 'User not found.', statusCode: 404 },
      { status: 404 },
    );
  }
  const user = userResult.value;

  const sessions = getSessionAdapter();
  const sessionResult = await sessions.create({
    userId: user.id,
    identityProvider: 'builtin',
  });
  if (sessionResult.isErr()) {
    return NextResponse.json(
      { code: 'INTERNAL', message: 'Session creation failed.', statusCode: 500 },
      { status: 500 },
    );
  }

  const { token } = sessionResult.value;
  const response = okResponse({
    id: user.id,
    email: user.primaryEmail,
    displayName: user.displayName,
    emailVerified: user.emailVerified,
    mfaEnabled: user.mfaEnabled,
  });
  setSessionCookie(response, token);
  return response;
}
