import { makeSystemContext } from '@platform/core';
import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

import { errorResponse, okResponse } from '@/lib/server/api-helpers';
import { getAuthService, getUserDirectory } from '@/lib/server/auth-service';
import { setSessionCookie } from '@/lib/server/session';
import { issueMfaChallenge, twoFactorRequired } from '@/lib/server/two-factor';

const SignInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  remember: z.boolean().optional(),
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

  const parsed = SignInSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { code: 'VALIDATION', message: 'Invalid input', statusCode: 400 },
      { status: 400 },
    );
  }

  const ctx = makeSystemContext('auth.sign-in', randomUUID());
  const authService = getAuthService();

  const beginResult = await authService.beginSignIn(ctx, {
    method: 'password',
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (beginResult.isErr()) return errorResponse(beginResult.error);

  const challenge = beginResult.value.challenge;

  if (challenge.kind === 'complete') {
    const completeResult = await authService.completeSignIn(ctx, {
      method: 'password',
      code: parsed.data.email,
    });
    if (completeResult.isErr()) return errorResponse(completeResult.error);

    const { token, userId, expiresAt } = completeResult.value;

    const directory = getUserDirectory();
    const userResult = await directory.findById(userId);
    if (userResult.isErr() || !userResult.value) {
      return NextResponse.json(
        { code: 'NOT_FOUND', message: 'User not found', statusCode: 404 },
        { status: 404 },
      );
    }
    const user = userResult.value;

    // 2FA check — issue challenge instead of session when enabled
    if (twoFactorRequired()) {
      const challengeId = await issueMfaChallenge(user.id, user.primaryEmail);
      return NextResponse.json(
        { code: 'MFA_REQUIRED', challengeId, statusCode: 202 },
        { status: 202 },
      );
    }

    const response = okResponse({
      session: {
        accessToken: token,
        refreshToken: token,
        expiresAt: expiresAt.getTime(),
        userId: user.id,
        workspaceId: '',
      },
      user: {
        id: user.id,
        email: user.primaryEmail,
        displayName: user.displayName,
        emailVerified: user.emailVerified,
        mfaEnabled: user.mfaEnabled,
        createdAt: user.createdAt.toISOString(),
      },
    });

    setSessionCookie(response, token);
    return response;
  }

  if (challenge.kind === 'mfa_required') {
    return NextResponse.json(
      { code: 'MFA_REQUIRED', challengeId: challenge.challengeId, statusCode: 202 },
      { status: 202 },
    );
  }

  return NextResponse.json(
    { code: 'UNKNOWN', message: 'Unexpected challenge type', statusCode: 500 },
    { status: 500 },
  );
}
