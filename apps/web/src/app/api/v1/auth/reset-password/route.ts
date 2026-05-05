import { NextResponse } from 'next/server';
import { z } from 'zod';

import { okResponse } from '@/lib/server/api-helpers';

const ResetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ code: 'VALIDATION', message: 'Invalid JSON', statusCode: 400 }, { status: 400 });
  }

  const parsed = ResetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { code: 'VALIDATION', message: parsed.error.issues[0]?.message ?? 'Invalid input', statusCode: 400 },
      { status: 400 },
    );
  }

  // TODO: verify token, look up user, update password hash via identity-builtin adapter
  // For dev: accept any token starting with 'dev-reset-'
  if (!parsed.data.token.startsWith('dev-reset-')) {
    return NextResponse.json(
      { code: 'NOT_FOUND', message: 'Invalid or expired reset link.', statusCode: 404 },
      { status: 404 },
    );
  }

  return okResponse({ message: 'Password reset successfully. You can now sign in.' });
}
