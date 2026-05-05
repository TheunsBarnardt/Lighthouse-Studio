import type { NextRequest } from 'next/server';

import { NextResponse } from 'next/server';

import { verifySessionFromRequest } from '@/lib/server/session';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await verifySessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Not authenticated.', statusCode: 401 }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ code: 'BAD_REQUEST', message: 'file is required.', statusCode: 400 }, { status: 400 });
  }

  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ code: 'BAD_REQUEST', message: 'File must be JPEG, PNG, WebP or GIF.', statusCode: 400 }, { status: 400 });
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ code: 'BAD_REQUEST', message: 'File must be under 5 MB.', statusCode: 400 }, { status: 400 });
  }

  // TODO: AvatarService.uploadAvatar(session.userId, file, ctx)
  return NextResponse.json({ avatarUrl: null, message: 'Avatar uploaded.' });
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const session = await verifySessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Not authenticated.', statusCode: 401 }, { status: 401 });
  }

  // TODO: AvatarService.deleteAvatar(session.userId, ctx)
  return NextResponse.json({ message: 'Avatar removed.' });
}
