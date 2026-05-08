import type { NextRequest } from 'next/server';

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { okResponse } from '@/lib/server/api-helpers';
import { getSessionAdapter, getUserDirectory } from '@/lib/server/auth-service';
import { setSessionCookie } from '@/lib/server/session';
import { completeSso } from '@/lib/server/sso';

const CallbackSchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { code: 'VALIDATION', message: 'Invalid JSON', statusCode: 400 },
      { status: 400 },
    );
  }

  const parsed = CallbackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { code: 'VALIDATION', message: 'Invalid input', statusCode: 400 },
      { status: 400 },
    );
  }

  let ssoResult: Awaited<ReturnType<typeof completeSso>>;
  try {
    ssoResult = await completeSso(parsed.data.code, parsed.data.state);
  } catch (e) {
    return NextResponse.json(
      {
        code: 'AUTHENTICATION_FAILED',
        message: e instanceof Error ? e.message : 'SSO authentication failed.',
        statusCode: 401,
      },
      { status: 401 },
    );
  }

  const directory = getUserDirectory();

  // Find or create user
  let userId: string;

  const byIdentity = await directory.findByIdentity(ssoResult.providerId, ssoResult.subject);
  if (byIdentity.isOk() && byIdentity.value) {
    userId = byIdentity.value.id;
  } else {
    // Try to link to existing password account with the same email
    const byEmail = await directory.findByEmail(ssoResult.email);
    if (byEmail.isOk() && byEmail.value) {
      await directory.linkIdentity(byEmail.value.id, {
        providerId: ssoResult.providerId,
        subject: ssoResult.subject,
        email: ssoResult.email,
        emailVerified: ssoResult.emailVerified,
        primary: false,
        linkedAt: new Date(),
        lastUsedAt: null,
      });
      userId = byEmail.value.id;
    } else {
      // Brand-new user via SSO — create account
      const created = await directory.create({
        email: ssoResult.email,
        displayName: ssoResult.displayName,
        identity: {
          providerId: ssoResult.providerId,
          subject: ssoResult.subject,
          email: ssoResult.email,
          emailVerified: ssoResult.emailVerified,
          primary: true,
        },
      });
      if (created.isErr()) {
        return NextResponse.json(
          { code: 'INTERNAL', message: 'Failed to create account.', statusCode: 500 },
          { status: 500 },
        );
      }
      userId = created.value.id;
    }
  }

  // Create session
  const sessions = getSessionAdapter();
  const sessionResult = await sessions.create({
    userId,
    identityProvider: ssoResult.providerId,
    ipAddress:
      request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? undefined,
    userAgent: request.headers.get('user-agent') ?? undefined,
  });

  if (sessionResult.isErr()) {
    return NextResponse.json(
      { code: 'INTERNAL', message: 'Session creation failed.', statusCode: 500 },
      { status: 500 },
    );
  }

  const { token } = sessionResult.value;

  const userResult = await directory.findById(userId);
  if (userResult.isErr() || !userResult.value) {
    return NextResponse.json(
      { code: 'NOT_FOUND', message: 'User not found.', statusCode: 404 },
      { status: 404 },
    );
  }
  const user = userResult.value;

  const response = okResponse({
    returnTo: ssoResult.returnTo,
    user: {
      id: user.id,
      email: user.primaryEmail,
      displayName: user.displayName,
      emailVerified: user.emailVerified,
      mfaEnabled: user.mfaEnabled,
    },
  });
  setSessionCookie(response, token);
  return response;
}
