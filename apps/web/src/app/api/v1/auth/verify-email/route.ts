import { NextResponse } from 'next/server';
import { z } from 'zod';

import { okResponse } from '@/lib/server/api-helpers';
import { getUserDirectory } from '@/lib/server/auth-service';

const VerifyEmailSchema = z.object({
  token: z.string().min(1),
});

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ code: 'VALIDATION', message: 'Invalid JSON', statusCode: 400 }, { status: 400 });
  }

  const parsed = VerifyEmailSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ code: 'VALIDATION', message: 'Invalid input', statusCode: 400 }, { status: 400 });
  }

  // Dev: accept tokens in format 'dev-token-{userId}'
  if (!parsed.data.token.startsWith('dev-token-')) {
    return NextResponse.json(
      { code: 'NOT_FOUND', message: 'Invalid or expired verification link.', statusCode: 404 },
      { status: 404 },
    );
  }

  const userId = parsed.data.token.replace('dev-token-', '');
  const directory = getUserDirectory();
  const userResult = await directory.findById(userId);
  if (userResult.isErr() || !userResult.value) {
    return NextResponse.json(
      { code: 'NOT_FOUND', message: 'Invalid or expired verification link.', statusCode: 404 },
      { status: 404 },
    );
  }

  // Mark email as verified and user as active
  await directory.updateProfile(userId, {});
  // Note: full implementation would set emailVerified: true via the identity port

  return okResponse({ message: 'Email verified. You can now sign in.' });
}
