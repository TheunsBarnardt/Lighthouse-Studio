import { NextResponse } from 'next/server';
import { z } from 'zod';

import { okResponse } from '@/lib/server/api-helpers';
import { getUserDirectory } from '@/lib/server/auth-service';

const RequestMagicLinkSchema = z.object({
  email: z.string().email(),
});

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ code: 'VALIDATION', message: 'Invalid JSON', statusCode: 400 }, { status: 400 });
  }

  const parsed = RequestMagicLinkSchema.safeParse(body);
  if (!parsed.success) {
    return okResponse({ message: 'If an account exists, a magic link has been sent.' });
  }

  const directory = getUserDirectory();
  await directory.findByEmail(parsed.data.email);
  // TODO: generate magic-link token and send email via EmailTemplateService

  return okResponse({ message: 'If an account exists, a magic link has been sent.' });
}

export function GET(request: Request): NextResponse {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');

  if (!token?.startsWith('dev-magic-')) {
    return NextResponse.json(
      { code: 'NOT_FOUND', message: 'Invalid or expired magic link.', statusCode: 404 },
      { status: 404 },
    );
  }

  return okResponse({ message: 'Magic link consumed.' });
}
