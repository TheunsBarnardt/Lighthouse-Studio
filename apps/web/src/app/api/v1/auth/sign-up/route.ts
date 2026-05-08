import type { NextRequest } from 'next/server';

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { okResponse } from '@/lib/server/api-helpers';
import { getSessionAdapter, getUserDirectory } from '@/lib/server/auth-service';
import { captchaEnabled, getCaptchaProvider } from '@/lib/server/captcha';
import { emailVerificationRequired, sendVerificationEmail } from '@/lib/server/email';
import { setSessionCookie } from '@/lib/server/session';

const SignUpSchema = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  displayName: z.string().min(1).max(255),
  captchaToken: z.string().optional(),
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

  const parsed = SignUpSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        code: 'VALIDATION',
        message: parsed.error.issues[0]?.message ?? 'Invalid input',
        statusCode: 400,
      },
      { status: 400 },
    );
  }

  if (captchaEnabled()) {
    const token = parsed.data.captchaToken ?? '';
    const remoteIp =
      request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? undefined;
    const ok = await getCaptchaProvider().verify(token, remoteIp);
    if (!ok) {
      return NextResponse.json(
        { code: 'CAPTCHA_FAILED', message: 'CAPTCHA verification failed.', statusCode: 400 },
        { status: 400 },
      );
    }
  }

  const directory = getUserDirectory();

  const existing = await directory.findByEmail(parsed.data.email);
  if (existing.isOk() && existing.value) {
    return NextResponse.json(
      {
        code: 'CONFLICT',
        message: 'An account with this email already exists.',
        statusCode: 409,
      },
      { status: 409 },
    );
  }

  const requireVerification = emailVerificationRequired();

  const createResult = await directory.create({
    email: parsed.data.email,
    displayName: parsed.data.displayName,
    identity: {
      providerId: 'builtin',
      subject: parsed.data.email,
      email: parsed.data.email,
      // When verification is required the user starts unverified
      emailVerified: !requireVerification,
      primary: true,
    },
  });

  if (createResult.isErr()) {
    return NextResponse.json(
      { code: 'INTERNAL', message: 'Failed to create account.', statusCode: 500 },
      { status: 500 },
    );
  }

  const user = createResult.value;

  // Email verification path — send email (fictional: logs to console) and tell the client
  if (requireVerification) {
    await sendVerificationEmail(user.primaryEmail, user.id);
    return okResponse({
      emailVerificationRequired: true,
      message:
        'Account created. Check your email (or server console in dev) for a verification link.',
    });
  }

  // No verification required — create session immediately
  const sessions = getSessionAdapter();
  const sessionResult = await sessions.create({
    userId: user.id,
    identityProvider: 'builtin',
    ipAddress:
      request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? undefined,
    userAgent: request.headers.get('user-agent') ?? undefined,
  });

  if (sessionResult.isErr()) {
    return NextResponse.json(
      {
        code: 'INTERNAL',
        message: 'Account created but session could not be started.',
        statusCode: 500,
      },
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
    createdAt: user.createdAt.toISOString(),
  });

  setSessionCookie(response, token);
  return response;
}
