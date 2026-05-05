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
  const userResult = await directory.findById(userId);
  if (userResult.isErr()) {
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to fetch member', statusCode: 500 },
      { status: 500 },
    );
  }
  if (!userResult.value) {
    return NextResponse.json(
      { code: 'NOT_FOUND', message: 'Member not found.', statusCode: 404 },
      { status: 404 },
    );
  }
  const user = userResult.value;

  return NextResponse.json({
    id: user.id,
    email: user.primaryEmail,
    displayName: user.displayName,
    status: user.status,
    identities: user.identities,
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

  const body = (await request.json()) as { displayName?: string; status?: string };
  const directory = getUserDirectory();

  if (body.displayName !== undefined) {
    const result = await directory.updateProfile(userId, { displayName: body.displayName });
    if (result.isErr()) {
      return NextResponse.json(
        { code: 'INTERNAL_ERROR', message: 'Failed to update member', statusCode: 500 },
        { status: 500 },
      );
    }
  }

  if (body.status === 'archived') {
    const result = await directory.archive(userId);
    if (result.isErr()) {
      return NextResponse.json(
        { code: 'INTERNAL_ERROR', message: 'Failed to update member', statusCode: 500 },
        { status: 500 },
      );
    }
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
  const result = await directory.archive(userId);
  if (result.isErr()) {
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to remove member', statusCode: 500 },
      { status: 500 },
    );
  }

  return NextResponse.json({ message: 'Member removed.' });
}
