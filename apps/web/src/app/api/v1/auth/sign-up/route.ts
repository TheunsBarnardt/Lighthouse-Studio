import type { NextRequest } from 'next/server';

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { okResponse } from '@/lib/server/api-helpers';
import { getUserDirectory } from '@/lib/server/auth-service';
import { captchaEnabled, getCaptchaProvider } from '@/lib/server/captcha';

const SignUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  displayName: z.string().min(1).max(255),
  captchaToken: z.string().optional(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ code: 'VALIDATION', message: 'Invalid JSON', statusCode: 400 }, { status: 400 });
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
    const remoteIp = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? undefined;
    const ok = await getCaptchaProvider().verify(token, remoteIp);
    if (!ok) {
      return NextResponse.json({ code: 'CAPTCHA_FAILED', message: 'CAPTCHA verification failed.', statusCode: 400 }, { status: 400 });
    }
  }

  const directory = getUserDirectory();

  // Check if email already exists
  const existing = await directory.findByEmail(parsed.data.email);
  if (existing.isOk() && existing.value) {
    // Return success even on duplicate to prevent email enumeration
    return okResponse({ message: 'Check your email for a verification link.' });
  }

  // Create user with pending_verification status
  const createResult = await directory.create({
    email: parsed.data.email,
    displayName: parsed.data.displayName,
    identity: {
      providerId: 'builtin',
      subject: parsed.data.email,
      email: parsed.data.email,
      emailVerified: false,
      primary: true,
    },
  });

  if (createResult.isErr()) {
    // Also return success to prevent enumeration
    return okResponse({ message: 'Check your email for a verification link.' });
  }

  // TODO: send verification email via EmailTemplateService + EmailPort

  return okResponse({ message: 'Check your email for a verification link.' });
}
