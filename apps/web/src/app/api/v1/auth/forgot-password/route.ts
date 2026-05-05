import type { NextRequest } from 'next/server';

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { okResponse } from '@/lib/server/api-helpers';
import { getUserDirectory } from '@/lib/server/auth-service';
import { captchaEnabled, getCaptchaProvider } from '@/lib/server/captcha';

const ForgotPasswordSchema = z.object({
  email: z.string().email(),
  captchaToken: z.string().optional(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ code: 'VALIDATION', message: 'Invalid JSON', statusCode: 400 }, { status: 400 });
  }

  const parsed = ForgotPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return okResponse({ message: 'If an account exists, a reset link has been sent.' });
  }

  if (captchaEnabled()) {
    const token = parsed.data.captchaToken ?? '';
    const remoteIp = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? undefined;
    const ok = await getCaptchaProvider().verify(token, remoteIp);
    if (!ok) {
      // Still return the opaque message to prevent probing
      return okResponse({ message: 'If an account exists, a reset link has been sent.' });
    }
  }

  const directory = getUserDirectory();
  const userResult = await directory.findByEmail(parsed.data.email);

  if (userResult.isOk() && userResult.value) {
    // TODO: generate reset token and send email via EmailTemplateService
  }

  // Always return success to prevent email enumeration
  return okResponse({ message: 'If an account exists, a reset link has been sent.' });
}
