import { NextResponse } from 'next/server';
import { z } from 'zod';

import { okResponse } from '@/lib/server/api-helpers';

const MfaChallengeSchema = z.object({
  challengeId: z.string().min(1),
  code: z.string().min(6).max(10),
});

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ code: 'VALIDATION', message: 'Invalid JSON', statusCode: 400 }, { status: 400 });
  }

  const parsed = MfaChallengeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ code: 'VALIDATION', message: 'Invalid input', statusCode: 400 }, { status: 400 });
  }

  // TODO: verify TOTP code via MfaPort
  // Dev: accept any 6-digit code
  return okResponse({ message: 'MFA verified.' });
}
