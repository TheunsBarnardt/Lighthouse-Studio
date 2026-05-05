import type { NextRequest } from 'next/server';

import { NextResponse } from 'next/server';

import { requestContextFromSession } from '@/lib/server/session';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const { slug } = await params;
  const ctx = await requestContextFromSession(slug, request);
  if (!ctx) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Not authenticated.', statusCode: 401 }, { status: 401 });
  }

  // TODO: InvitationService.listPending(workspaceId)
  return NextResponse.json({ items: [] });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const { slug } = await params;
  const ctx = await requestContextFromSession(slug, request);
  if (!ctx) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Not authenticated.', statusCode: 401 }, { status: 401 });
  }

  const { token } = (await request.json()) as { token: string };
  if (!token) {
    return NextResponse.json({ code: 'BAD_REQUEST', message: 'token required', statusCode: 400 }, { status: 400 });
  }

  // TODO: InvitationService.revoke(token, ctx)
  return NextResponse.json({ message: 'Invitation revoked.' });
}
