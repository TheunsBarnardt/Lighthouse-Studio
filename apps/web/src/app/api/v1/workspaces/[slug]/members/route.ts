import type { NextRequest } from 'next/server';

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { okResponse } from '@/lib/server/api-helpers';
import { requestContextFromSession } from '@/lib/server/session';

const InviteSchema = z.object({
  email: z.string().email(),
  roleIds: z.array(z.string()).min(1),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const { slug } = await params;
  const ctx = await requestContextFromSession(slug, request);
  if (!ctx) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Not authenticated.', statusCode: 401 }, { status: 401 });
  }

  // TODO: use MemberService.listMembers via composition root
  // Dev: return empty list
  return okResponse({ items: [], total: 0, nextCursor: null });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const { slug } = await params;
  const ctx = await requestContextFromSession(slug, request);
  if (!ctx) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Not authenticated.', statusCode: 401 }, { status: 401 });
  }

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ code: 'VALIDATION', message: 'Invalid JSON', statusCode: 400 }, { status: 400 });
  }

  const parsed = InviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ code: 'VALIDATION', message: 'Invalid input', statusCode: 400 }, { status: 400 });
  }

  // TODO: send invitation via InvitationService
  return okResponse({ message: `Invitation sent to ${parsed.data.email}` }, 201);
}
