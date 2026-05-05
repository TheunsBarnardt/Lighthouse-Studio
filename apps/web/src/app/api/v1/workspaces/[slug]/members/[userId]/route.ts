/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unnecessary-condition -- in-memory adapter types unresolved until packages rebuilt */
import type { NextRequest } from 'next/server';

import { NextResponse } from 'next/server';

import { getUserDirectory } from '@/lib/server/auth-service';
import { requestContextFromSession } from '@/lib/server/session';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; userId: string }> },
): Promise<NextResponse> {
  const { slug, userId } = await params;
  const ctx = await requestContextFromSession(slug, request);
  if (!ctx) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: 'Not authenticated.', statusCode: 401 },
      { status: 401 },
    );
  }

  const directory = getUserDirectory();
  let user;
  try {
    user = await directory.findById(userId);
  } catch {
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to fetch member', statusCode: 500 },
      { status: 500 },
    );
  }
  if (!user) {
    return NextResponse.json(
      { code: 'NOT_FOUND', message: 'Member not found.', statusCode: 404 },
      { status: 404 },
    );
  }

  return NextResponse.json({
    id: user.id,
    email: user.email,
    displayName: user.displayName || null,
    status: user.status,
    roles: user.roles || [],
    identities: user.identities || [],
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; userId: string }> },
): Promise<NextResponse> {
  const { slug, userId } = await params;
  const ctx = await requestContextFromSession(slug, request);
  if (!ctx) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: 'Not authenticated.', statusCode: 401 },
      { status: 401 },
    );
  }

  const body = (await request.json()) as { roles?: string[]; status?: string };
  const directory = getUserDirectory();
  let user;
  try {
    user = await directory.findById(userId);
  } catch {
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to fetch member', statusCode: 500 },
      { status: 500 },
    );
  }
  if (!user) {
    return NextResponse.json(
      { code: 'NOT_FOUND', message: 'Member not found.', statusCode: 404 },
      { status: 404 },
    );
  }

  try {
    if (body.roles !== undefined) {
      await directory.update(userId, { roles: body.roles });
    }
    if (body.status !== undefined) {
      await directory.update(userId, { status: body.status });
    }
  } catch {
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to update member', statusCode: 500 },
      { status: 500 },
    );
  }

  return NextResponse.json({ message: 'Member updated.' });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; userId: string }> },
): Promise<NextResponse> {
  const { slug, userId } = await params;
  const ctx = await requestContextFromSession(slug, request);
  if (!ctx) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: 'Not authenticated.', statusCode: 401 },
      { status: 401 },
    );
  }

  const directory = getUserDirectory();
  try {
    await directory.remove(userId);
  } catch {
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to remove member', statusCode: 500 },
      { status: 500 },
    );
  }

  return NextResponse.json({ message: 'Member removed.' });
}
